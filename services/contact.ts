interface ContactSubmissionPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
  company?: string;
  locale?: string;
  pagePath?: string;
}

const readFunctionError = async (response: Response) => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || response.statusText;
  } catch {
    return response.statusText || 'Request failed.';
  }
};

export const submitContactMessage = async (payload: ContactSubmissionPayload): Promise<void> => {
  const response = await fetch('/.netlify/functions/contact-submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readFunctionError(response));
  }
};
