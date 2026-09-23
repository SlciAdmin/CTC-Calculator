const SHEET_NAME = 'Users';
const OTP_EXPIRY_SECONDS = 10 * 60;
const SENDER_EMAIL = 'aiexecutive@slci.in';
const REPLY_TO_EMAIL = SENDER_EMAIL;
const FIREBASE_PROJECT_ID = 'ctc-calculator-51f6d';
const IDENTITY_TOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID;

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

// Run once from the Apps Script editor to grant the Firebase (UrlFetchApp) permission,
// then redeploy the web app as a new version.
function testFirebaseAccess() {
  if (!getServiceAccount_()) {
    const info = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + ScriptApp.getOAuthToken(), { muteHttpExceptions: true });
    Logger.log('No FIREBASE_SERVICE_ACCOUNT script property; using the owner token. Granted scopes: ' + (JSON.parse(info.getContentText()).scope || info.getContentText()));
  } else {
    Logger.log('Using FIREBASE_SERVICE_ACCOUNT script property.');
  }
  const user = findFirebaseUser_(SENDER_EMAIL);
  Logger.log('Firebase access OK. ' + SENDER_EMAIL + (user ? ' exists in Firebase.' : ' is not a Firebase user (that is fine).'));
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
    if (action === 'resetPassword') return resetPassword_(params, callback);
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

  // Firebase Auth is the source of truth for logins; the Sheet only has self-signup accounts.
  const sheet = getUsersSheet_();
  if (!(sheet && emailExists_(sheet, email)) && !findFirebaseUser_(email)) {
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

function resetPassword_(params, callback) {
  const email = clean_(params.email).toLowerCase();
  const otp = clean_(params.otp);
  const newPassword = String(params.newPassword || '');
  if (!email || !otp || !newPassword) return response_({ success: false, message: 'Email, OTP and new password are required' }, callback);
  if (newPassword.length < 8) return response_({ success: false, message: 'New password must be at least 8 characters' }, callback);
  if (!verifyOtp_(email, otp)) return response_({ success: false, message: 'Invalid or expired OTP' }, callback);

  const user = findFirebaseUser_(email);
  if (!user) return response_({ success: false, message: 'No account with this email' }, callback);
  identityToolkit_('accounts:update', { localId: user.localId, password: newPassword });
  return response_({ success: true, message: 'Password updated successfully' }, callback);
}

function findFirebaseUser_(email) {
  const lookup = identityToolkit_('accounts:lookup', { email: [email] });
  return lookup.users && lookup.users[0] ? lookup.users[0] : null;
}

// Firebase service account key JSON (Firebase Console > Project settings > Service accounts
// > Generate new private key), pasted into Script Properties as FIREBASE_SERVICE_ACCOUNT.
function getServiceAccount_() {
  const raw = PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT');
  return raw ? JSON.parse(raw) : null;
}

// Exchanges a signed JWT for a short-lived access token, cached for 50 minutes.
function getServiceAccountToken_(account) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('firebase-sa-token');
  if (cached) return cached;
  const now = Math.floor(Date.now() / 1000);
  const encode = function(obj) { return Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, ''); };
  const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  });
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(unsigned, account.private_key)).replace(/=+$/, '');
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + signature },
    muteHttpExceptions: true
  });
  const body = JSON.parse(res.getContentText() || '{}');
  if (!body.access_token) throw new Error('Service account sign-in failed (' + (body.error_description || body.error || res.getResponseCode()) + ')');
  cache.put('firebase-sa-token', body.access_token, 50 * 60);
  return body.access_token;
}

// Calls the Firebase Auth admin REST API, preferring the service account key and
// otherwise acting as the Apps Script owner (needs the cloud-platform scope and
// Owner/Editor on the Firebase project).
function identityToolkit_(method, payload) {
  const account = getServiceAccount_();
  const headers = account
    ? { Authorization: 'Bearer ' + getServiceAccountToken_(account) }
    : { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Goog-User-Project': FIREBASE_PROJECT_ID };
  const res = UrlFetchApp.fetch(IDENTITY_TOOLKIT_URL + '/' + method, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) {
    const reason = body.error && body.error.message ? body.error.message : ('HTTP ' + res.getResponseCode());
    console.error('Identity Toolkit ' + method + ' failed: ' + reason);
    throw new Error('Firebase account service error (' + reason + ')');
  }
  return body;
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
