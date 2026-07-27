import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las fotos y el video del héroe viajan por Server Actions. El límite por defecto
    // es 1 MB: sin esto, subir una foto pesada o un video se queda "Subiendo…" para
    // siempre. 12 MB deja margen sobre el máximo que valida el cargador (10 MB).
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
