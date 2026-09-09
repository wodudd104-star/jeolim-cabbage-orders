const API_URL = ((import.meta as any).env.VITE_API_URL as string) || '';

export async function sendSms(recipients: string[], message: string) {
  const url = API_URL ? `${API_URL}/api/send-sms` : '/api/send-sms';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipients, message }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}
