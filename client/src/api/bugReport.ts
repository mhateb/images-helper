export type BugReportParams = {
  description: string;
  contactEmail?: string;
  screenshot?: File | null;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) return data.error;
  } catch {
    // ignore
  }
  return fallback;
}

export async function sendBugReport(params: BugReportParams): Promise<void> {
  const form = new FormData();
  form.append('description', params.description.trim());
  if (params.contactEmail?.trim()) {
    form.append('contactEmail', params.contactEmail.trim());
  }
  form.append('pageUrl', window.location.href);
  form.append('userAgent', navigator.userAgent);
  if (params.screenshot) {
    form.append('screenshot', params.screenshot);
  }

  const response = await fetch('/api/bug-report', {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Не удалось отправить сообщение'));
  }
}
