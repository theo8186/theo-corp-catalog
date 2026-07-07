/**
 * THE-O CORPORATION — Buyer registration + login + email approval backend
 * ------------------------------------------------------------------
 * Deploy this inside a Google Sheet (Extensions > Apps Script).
 * See README.md in this project for full step-by-step setup.
 *
 * Flow:
 *  1. Website registration form POSTs {type:"register", ...} to doPost().
 *     A row is added to the "Applications" sheet with status "Pending",
 *     storing a SHA-256 hash of the buyer's chosen password (never the
 *     plain password).
 *  2. An email is sent to ADMIN_EMAIL with the applicant's details and
 *     Approve / Reject links. Each link calls doGet() with a token.
 *  3. Clicking Approve/Reject updates the sheet status and emails the
 *     applicant with the outcome.
 *  4. Once approved, the website's login form POSTs {type:"login", email,
 *     passwordHash} to doPost(), which checks the sheet for a matching,
 *     approved row and returns {ok:true}/{ok:false}.
 *
 * NOTE ON SECURITY: this is a lightweight, low-cost access gate suitable
 * for deterring casual browsing of a B2B catalog — it is not a substitute
 * for a real authentication backend. Passwords are hashed (SHA-256) before
 * they ever leave the buyer's browser, and only the hash is stored here,
 * but anyone with direct access to the published site's source files can
 * still read the underlying product data. See README.md for details.
 */

const ADMIN_EMAIL = "ychung0426@gmail.com";
const SHEET_NAME = "Applications";
const COMPANY_NAME = "THE-O CORPORATION";

const COLS = {
  TOKEN: 1, SUBMITTED: 2, COMPANY: 3, CONTACT: 4, COUNTRY: 5,
  EMAIL: 6, PHONE: 7, MESSAGE: 8, STATUS: 9, DECIDED: 10, PASSWORD_HASH: 11
};

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Token", "Submitted At", "Company", "Contact", "Country",
      "Email", "Phone", "Message", "Status", "Decided At", "Password Hash"
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function makeToken_() {
  return Utilities.getUuid().replace(/-/g, "").slice(0, 24);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data.type || "register";

    if (type === "login") return handleLogin_(data);
    return handleRegister_(data);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function handleRegister_(data) {
  const sheet = getSheet_();
  const token = makeToken_();

  sheet.appendRow([
    token,
    data.submittedAt || new Date().toISOString(),
    data.company || "",
    data.contact || "",
    data.country || "",
    (data.email || "").trim().toLowerCase(),
    data.phone || "",
    data.message || "",
    "Pending",
    "",
    data.passwordHash || ""
  ]);

  sendAdminApprovalEmail_(token, data);
  return jsonResponse_({ ok: true });
}

function handleLogin_(data) {
  const email = (data.email || "").trim().toLowerCase();
  const passwordHash = data.passwordHash || "";
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[COLS.EMAIL - 1]).trim().toLowerCase() === email) {
      const status = row[COLS.STATUS - 1];
      const storedHash = row[COLS.PASSWORD_HASH - 1];

      if (status !== "Approved") {
        return jsonResponse_({ ok: false, error: "Your application is still pending approval." });
      }
      if (!passwordHash || storedHash !== passwordHash) {
        return jsonResponse_({ ok: false, error: "Invalid email or password." });
      }
      return jsonResponse_({ ok: true });
    }
  }
  return jsonResponse_({ ok: false, error: "Invalid email or password." });
}

/** Handles Approve / Reject link clicks from the admin email. */
function doGet(e) {
  const token = e.parameter.token;
  const action = e.parameter.action;
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][COLS.TOKEN - 1] === token) {
      const rowNum = i + 1;
      const applicant = {
        company: values[i][COLS.COMPANY - 1], contact: values[i][COLS.CONTACT - 1],
        country: values[i][COLS.COUNTRY - 1], email: values[i][COLS.EMAIL - 1],
        phone: values[i][COLS.PHONE - 1], message: values[i][COLS.MESSAGE - 1]
      };
      const currentStatus = values[i][COLS.STATUS - 1];

      if (currentStatus !== "Pending") {
        return htmlResponse_("Already processed", "This application was already marked as <b>" + currentStatus + "</b>.");
      }

      const newStatus = action === "approve" ? "Approved" : "Rejected";
      sheet.getRange(rowNum, COLS.STATUS).setValue(newStatus);
      sheet.getRange(rowNum, COLS.DECIDED).setValue(new Date().toISOString());

      sendApplicantDecisionEmail_(applicant, newStatus);

      return htmlResponse_(
        newStatus === "Approved" ? "Buyer approved ✓" : "Application rejected",
        "<b>" + applicant.company + "</b> (" + applicant.email + ") has been marked as <b>" + newStatus + "</b>. " +
        (newStatus === "Approved"
          ? "They can now log in on the website with their registered email and password."
          : "A notification email has been sent to the applicant.")
      );
    }
  }
  return htmlResponse_("Not found", "No application matches this link. It may have already been actioned.");
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function htmlResponse_(title, bodyHtml) {
  const html =
    "<html><body style='font-family:sans-serif;max-width:520px;margin:60px auto;line-height:1.6;color:#1C1A17'>" +
    "<h2 style='color:#1F3D2E'>" + title + "</h2><p>" + bodyHtml + "</p></body></html>";
  return HtmlService.createHtmlOutput(html);
}

function sendAdminApprovalEmail_(token, data) {
  const scriptUrl = ScriptApp.getService().getUrl();
  const approveUrl = scriptUrl + "?token=" + encodeURIComponent(token) + "&action=approve";
  const rejectUrl = scriptUrl + "?token=" + encodeURIComponent(token) + "&action=reject";

  const subject = "New buyer application — " + (data.company || "Unknown company");
  const body =
    "A new overseas buyer application was submitted on the THE-O CORPORATION export catalog site.\n\n" +
    "Company: " + data.company + "\n" +
    "Contact person: " + data.contact + "\n" +
    "Country: " + data.country + "\n" +
    "Email: " + data.email + "\n" +
    "Phone: " + (data.phone || "-") + "\n" +
    "Message: " + (data.message || "-") + "\n\n" +
    "Approve: " + approveUrl + "\n" +
    "Reject: " + rejectUrl + "\n";

  MailApp.sendEmail(ADMIN_EMAIL, subject, body, {
    htmlBody:
      "<p>A new overseas buyer application was submitted on the <b>" + COMPANY_NAME + "</b> export catalog site.</p>" +
      "<table cellpadding='6' style='border-collapse:collapse'>" +
      "<tr><td><b>Company</b></td><td>" + data.company + "</td></tr>" +
      "<tr><td><b>Contact person</b></td><td>" + data.contact + "</td></tr>" +
      "<tr><td><b>Country</b></td><td>" + data.country + "</td></tr>" +
      "<tr><td><b>Email</b></td><td>" + data.email + "</td></tr>" +
      "<tr><td><b>Phone</b></td><td>" + (data.phone || "-") + "</td></tr>" +
      "<tr><td><b>Message</b></td><td>" + (data.message || "-") + "</td></tr>" +
      "</table>" +
      "<p style='margin-top:20px'>" +
      "<a href='" + approveUrl + "' style='background:#1F3D2E;color:#fff;padding:10px 18px;text-decoration:none;border-radius:4px;margin-right:10px'>Approve</a>" +
      "<a href='" + rejectUrl + "' style='background:#B25E28;color:#fff;padding:10px 18px;text-decoration:none;border-radius:4px'>Reject</a>" +
      "</p>"
  });
}

function sendApplicantDecisionEmail_(applicant, status) {
  if (!applicant.email) return;
  if (status === "Approved") {
    const subject = "Your " + COMPANY_NAME + " buyer account is approved";
    const body =
      "Dear " + applicant.contact + ",\n\n" +
      "Thank you for registering with " + COMPANY_NAME + ". Your buyer account for " + applicant.company +
      " has been approved. You can now log in on our website using the email and password you registered with.\n\n" +
      "Best regards,\n" + COMPANY_NAME;
    MailApp.sendEmail(applicant.email, subject, body);
  } else {
    const subject = "Update on your " + COMPANY_NAME + " application";
    const body =
      "Dear " + applicant.contact + ",\n\n" +
      "Thank you for your interest in " + COMPANY_NAME + ". After review, we're unable to approve this application " +
      "at this time. Please reply to this email if you'd like more information.\n\n" +
      "Best regards,\n" + COMPANY_NAME;
    MailApp.sendEmail(applicant.email, subject, body);
  }
}
