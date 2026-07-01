export const DEFAULT_SELECTORS = {
  login: {
    username: "input[name='username']",
    password: "input[name='password']",
    submit: "button[type='submit']"
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
