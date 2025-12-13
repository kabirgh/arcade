import QRCode from "qrcode";

import config from "./config";

// Only generate WiFi QR code for local mode
if (config.mode === "local") {
  QRCode.toFile(
    `./client/public/qr-wifi.png`,
    `WIFI:S:${config.wifi.ssid};T:WPA;P:${config.wifi.password};;`,
    {
      width: 800,
      margin: 2,
      errorCorrectionLevel: "M",
    },
    function (err) {
      if (err) throw err;
      console.log("Generated WiFi QR code");
    }
  );
}

// Generate join URL QR code based on mode
let joinUrl: string;

if (config.mode === "internet") {
  // Internet mode: use domain with HTTPS
  const port = config.internet.port === 443 ? "" : `:${config.internet.port}`;
  joinUrl = `https://${config.internet.domain}${port}/join`;
} else {
  // Local mode: use IP address with HTTP
  const port =
    process.env.NODE_ENV === "production"
      ? config.server.port
      : config.vite.port;
  joinUrl = `http://${config.server.host}:${port}/join`;
}

QRCode.toFile(
  `./client/public/qr-joinurl.png`,
  joinUrl,
  {
    width: 800,
    margin: 2,
    errorCorrectionLevel: "M",
  },
  function (err) {
    if (err) throw err;
    console.log(`Generated join URL QR code: ${joinUrl}`);
  }
);
