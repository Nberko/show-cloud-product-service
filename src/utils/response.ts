export const ok = (data: any) => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const badRequest = (message: string) => ({
  statusCode: 400,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ error: message }),
});

export const internalError = (statusCode: number = 500, message: string) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ error: message }),
});

export const cors = () => {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}