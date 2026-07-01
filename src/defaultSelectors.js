export const DEFAULT_SELECTORS = {
  login: {
    username: "#id_username, input[name='username']",
    usernameContinue: "#id_btn_sso",
    password: "#id_password, input[name='password']",
    submit: "#id_btn_signin, button:has-text('Login'), input[type='submit']"
  },
  navigation: {
    reportsTab: "text=Reports"
  },
  reportFilters: {
    reportType: "select[name='reportType']",
    reportTypeValue: "Unsigned Care Logs",
    fromDate: "input[name='fromDate']",
    toDate: "input[name='toDate']",
    groupBy: "select[name='groupBy']",
    groupByValue: "State Client",
    client: "select[name='client']",
    allClientsValue: "all",
    runReport: "button:has-text('Run Report')"
  },
  results: {
    rows: "table tbody tr",
    clientSigned: "[data-column='client-signed']",
    caregiverSigned: "[data-column='caregiver-signed']",
    notSignedLink: "a:has-text('Not Signed')"
  },
  careLog: {
    taskRows: "[data-task-row]",
    taskStatus: "[data-task-status]",
    completedValues: ["checked", "complete", "completed", "yes", "true"],
    signButton: "button:has-text('Sign')",
    popup: "[role='dialog']",
    managerNameLine: "[data-care-manager-name]",
    signatureField: "textarea[name='signature']",
    submitSignature: "button:has-text('Submit')"
  }
};
