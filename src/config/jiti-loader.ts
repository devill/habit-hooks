import { createJiti, type Jiti } from 'jiti';

let cached: Jiti | null = null;

function getJiti(): Jiti {
  if (cached) return cached;
  cached = createJiti(import.meta.url, { interopDefault: true });
  return cached;
}

export async function loadTsModule(absolutePath: string): Promise<unknown> {
  const jiti = getJiti();
  return jiti.import(absolutePath, { default: true });
}
