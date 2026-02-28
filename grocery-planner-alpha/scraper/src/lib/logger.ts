const timestamp = () => new Date().toISOString().slice(11, 19);

export const log = {
  info: (msg: string) => console.log(`[${timestamp()}] ${msg}`),
  warn: (msg: string) => console.warn(`[${timestamp()}] WARN ${msg}`),
  error: (msg: string) => console.error(`[${timestamp()}] ERROR ${msg}`),
  progress: (current: number, total: number, label: string) => {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    console.log(`[${timestamp()}] [${pct}%] ${current}/${total} ${label}`);
  },
};
