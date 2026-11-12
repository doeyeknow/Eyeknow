/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The book PDFs ship split into small parts (deploy uploader
    // cap); make sure the download route's function bundle includes
    // them so it can reassemble and stream the originals.
    outputFileTracingIncludes: {
      "/api/books/download": ["./books/**/*.part"],
    },
  },
};

export default nextConfig;
