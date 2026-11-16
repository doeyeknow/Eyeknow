/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The book PDFs ship split into small parts (deploy uploader
    // cap); make sure the download route's function bundle includes
    // them so it can reassemble and stream the originals.
    outputFileTracingIncludes: {
      "/api/books/download": ["./books/**/*.part"],
      // The native APK served (stamped per referral) by the
      // app download endpoint — same bundle-inclusion need.
      "/api/app/download": ["./app-binary/eyeknow.apk"],
    },
  },
};

export default nextConfig;
