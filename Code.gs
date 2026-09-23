const SHEET_NAME = 'Users';
const OTP_EXPIRY_SECONDS = 10 * 60;
const SENDER_EMAIL = 'aiexecutive@slci.in';
const REPLY_TO_EMAIL = SENDER_EMAIL;

function testGmail() {
  const recipient = Session.getEffectiveUser().getEmail();
  assertSenderConfigured_();
  GmailApp.sendEmail(
    recipient,
    'CTC Calculator Gmail test',
    'This test confirms that the Apps Script owner can send Gmail messages.',
    { name: 'SLCI', from: SENDER_EMAIL, replyTo: REPLY_TO_EMAIL }
  );
  Logger.log('Test email sent from ' + SENDER_EMAIL + ' to ' + recipient);
}

function doGet(e) {
  return handleRequest_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    return handleRequest_(data);
  } catch (error) {
    return response_({ success: false, message: 'Invalid JSON request' });
  }
}

function handleRequest_(params) {
  const callback = cleanCallback_(params.callback);
  try {
    const action = String(params.action || 'createAccount').trim();
    if (action === 'diagnostic') return diagnostic_(callback);
    if (action === 'sendOtp') return sendOtp_(params, callback);
    if (action === 'verifyOtp') return verifyOtpRequest_(params, callback);
    if (action === 'createAccount') return createAccount_(params, callback);
    return response_({ success: false, message: 'Unsupported action' }, callback);
  } catch (error) {
    return response_({ success: false, message: error.message }, callback);
  }
}

function diagnostic_(callback) {
  try {
    const aliases = GmailApp.getAliases();
    const effectiveEmail = Session.getEffectiveUser().getEmail();
    const aliasEmails = aliases.map(function(alias) { return alias.toLowerCase().trim(); });
    const senderAvailable = effectiveEmail.toLowerCase().trim() === SENDER_EMAIL || aliasEmails.indexOf(SENDER_EMAIL) !== -1;
    return response_({
      success: true,
      effectiveEmail: effectiveEmail,
      configuredSender: SENDER_EMAIL,
      aliases: aliases,
      senderAvailable: senderAvailable,
      remainingDailyQuota: GmailApp.getRemainingDailyQuota(),
      message: senderAvailable ? 'Sender is configured' : 'Configured sender is not the Apps Script owner or a verified Gmail alias'
    }, callback);
  } catch (error) {
    return response_({ success: false, message: error.message }, callback);
  }
}

function createAccount_(params, callback) {
  const email = clean_(params.email);
  const companyName = clean_(params.companyName);
  const password = clean_(params.password);
  const contactNumber = clean_(params.contactNumber);
  const userName = clean_(params.userName);

  if (!email || !companyName || !password || !contactNumber || !userName) {
    return response_({ success: false, message: 'All fields are required' }, callback);
  }

  const sheet = getUsersSheet_();
  if (!sheet) return response_({ success: false, message: 'Users sheet not found' }, callback);
  if (emailExists_(sheet, email)) {
    return response_({ success: false, message: 'Email already exists' }, callback);
  }

  const id = clean_(params.id) || ('USR-' + new Date().getTime());
  sheet.appendRow([id, email, companyName, password, contactNumber, userName, new Date()]);

  let mailSent = true;
  let mailMessage = 'Credentials emailed successfully';
  try {
    assertSenderConfigured_();
    GmailApp.sendEmail(
      email,
      'Your CTC Calculator account',
      'Hello ' + userName + ',\n\nYour CTC Calculator account has been created.\n\nEmail: ' + email + '\nTemporary password: ' + password + '\n\nPlease sign in and use Change password to set a new password.\n\nRegards,\nSLCI',
      { name: 'SLCI', from: SENDER_EMAIL, replyTo: REPLY_TO_EMAIL }
    );
  } catch (mailError) {
    mailSent = false;
    mailMessage = 'Account saved to Sheet, but email failed: ' + mailError.message;
    console.error(mailMessage);
    console.error(JSON.stringify({ name: mailError.name, message: mailError.message, stack: mailError.stack }));
  }

  return response_({
    success: true,
    message: mailMessage,
    mailSent: mailSent,
    data: { id, email, companyName, contactNumber, userName }
  }, callback);
}

function sendOtp_(params, callback) {
  const email = clean_(params.email).toLowerCase();
  if (!email) return response_({ success: false, message: 'Email is required' }, callback);

  const sheet = getUsersSheet_();
  if (!sheet || !emailExists_(sheet, email)) {
    return response_({ success: false, message: 'No account with this email' }, callback);
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  CacheService.getScriptCache().put('password-otp:' + email, otp, OTP_EXPIRY_SECONDS);
  assertSenderConfigured_();
  GmailApp.sendEmail(
    email,
    'Your CTC Calculator password OTP',
    'Your one-time password is: ' + otp + '\n\nThis OTP expires in 10 minutes.\n\nRegards,\nSLCI',
    { name: 'SLCI', from: SENDER_EMAIL, replyTo: REPLY_TO_EMAIL }
  );
  return response_({ success: true, message: 'OTP sent successfully' }, callback);
}

function verifyOtpRequest_(params, callback) {
  const email = clean_(params.email).toLowerCase();
  const otp = clean_(params.otp);
  if (!email || !otp) return response_({ success: false, message: 'Email and OTP are required' }, callback);
  if (!verifyOtp_(email, otp)) return response_({ success: false, message: 'Invalid or expired OTP' }, callback);
  return response_({ success: true, message: 'OTP verified successfully' }, callback);
}

function verifyOtp_(email, otp) {
  const key = 'password-otp:' + email.toLowerCase();
  const expected = CacheService.getScriptCache().get(key);
  if (!expected || expected !== String(otp).trim()) return false;
  CacheService.getScriptCache().remove(key);
  return true;
}

function getUsersSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function emailExists_(sheet, email) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  return sheet.getRange(2, 2, lastRow - 1, 1).getValues().some(function(row) {
    return String(row[0]).toLowerCase().trim() === email.toLowerCase();
  });
}

function clean_(value) {
  return String(value || '').trim();
}

function assertSenderConfigured_() {
  const aliases = GmailApp.getAliases().map(function(alias) {
    return alias.toLowerCase().trim();
  });
  const effectiveEmail = Session.getEffectiveUser().getEmail().toLowerCase().trim();
  if (effectiveEmail !== SENDER_EMAIL && aliases.indexOf(SENDER_EMAIL) === -1) {
    throw new Error('Add ' + SENDER_EMAIL + ' as a Gmail alias for the Apps Script owner, then run this again.');
  }
}

function cleanCallback_(value) {
  const callback = clean_(value);
  return /^[A-Za-z_$][\w$]*$/.test(callback) ? callback : '';
}

function response_(data, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(data) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
