export type DateRange = {
  from: Date;
  to: Date;
  timezone: string;
};

export type TargetCredentials = {
  targetUrl: string;
  username: string;
  password: string;
  signatureTemplate: string;
  captureSnapshots: boolean;
};

export type ReportRow = {
  reportRowKey: string;
  clientName: string;
  careLogDate: Date;
  sourceUrl?: string;
  activityLabel?: string;
  clientSigned: boolean;
  caregiverSigned: boolean;
  notSignedLabel?: string;
};

export type CareLogTaskSnapshot = {
  taskTime?: string;
  taskName: string;
  statusLabel: string;
  isChecked: boolean;
};

export type AutomationStepError = {
  stepName: string;
  currentUrl?: string;
  message: string;
  screenshotPath?: string;
};
