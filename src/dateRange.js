function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function yesterday(referenceDate = new Date()) {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}

export function resolveDateRange(input = {}, referenceDate = new Date()) {
  if (input.dateMode === "custom") {
    if (!input.fromDate || !input.toDate) {
      throw new Error("Custom date range requires fromDate and toDate.");
    }
    return {
      fromDate: input.fromDate,
      toDate: input.toDate
    };
  }

  const day = yesterday(referenceDate);
  return {
    fromDate: day,
    toDate: day
  };
}
