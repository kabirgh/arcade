import QRCode from "qrcode";

import config from "./config";

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
  }
);

const port =
  process.env.NODE_ENV === "production" ? config.server.port : config.vite.port;

QRCode.toFile(
  `./client/public/qr-joinurl.png`,
  `http://${config.server.host}:${port}/join`,
  {
    width: 800,
    margin: 2,
    errorCorrectionLevel: "M",
  },
  function (err) {
    if (err) throw err;
  }
);

console.log("Generated QR codes");
