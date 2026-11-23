import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,
  // the patient area moved from /dashboard to /patient-dashboard; old links and bookmarks keep working
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/patient-dashboard",
        permanent: true,
      },
      {
        source: "/dashboard/:path*",
        destination: "/patient-dashboard/:path*",
        permanent: true,
      },
      // doctor portal v2 (17 Nov 2026 call): the doctor has Today, History and Availability, and since
      // 23 Nov 2026 Patients (their own patients and each one's chart). The other old places send their
      // links to Today; their code stays in the repo for the back office.
      ...["schedule", "notes", "messages"].flatMap((place) => [
        {
          source: `/doctor-dashboard/${place}`,
          destination: "/doctor-dashboard",
          permanent: false,
        },
        {
          source: `/doctor-dashboard/${place}/:path*`,
          destination: "/doctor-dashboard",
          permanent: false,
        },
      ]),
    ];
  },
};

export default nextConfig;
