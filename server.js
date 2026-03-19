const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, "data", "applications.json");
const MAX_APPLICATIONS_PER_IP = 2;

const ALLOWED_IPS = [
  "220.89.72.182",
  "::1".
  "127.0.0.1"
  // "여기에_네_공인_IP"
];

app.set("trust proxy", true);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

function readApplications() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeApplications(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function normalizeIp(ip) {
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) return ip.replace("::ffff:", "");
  return ip;
}

app.post("/api/apply", (req, res) => {
  const { playerName } = req.body;
  const clientIp = normalizeIp(req.ip);

  if (!playerName || typeof playerName !== "string") {
    return res.status(400).json({ message: "닉네임이 올바르지 않습니다." });
  }

  const trimmedName = playerName.trim();

  if (trimmedName.length < 2 || trimmedName.length > 16) {
    return res.status(400).json({ message: "닉네임은 2자 이상 16자 이하만 가능합니다." });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmedName)) {
    return res.status(400).json({ message: "닉네임은 영문, 숫자, 밑줄(_)만 사용할 수 있습니다." });
  }

  const applications = readApplications();

  const sameIpCount = applications.filter(app => app.ip === clientIp).length;

  if (sameIpCount >= MAX_APPLICATIONS_PER_IP) {
    return res.status(429).json({
      message: "한 IP당 가입 신청은 최대 2번까지만 가능합니다."
    });
  }

  applications.push({
    playerName: trimmedName,
    ip: clientIp,
    createdAt: new Date().toISOString()
  });

  writeApplications(applications);

  return res.json({
    message: `가입 신청이 정상적으로 접수되었습니다. (${sameIpCount + 1}/${MAX_APPLICATIONS_PER_IP})`
  });
});

app.get("/api/applications", (req, res) => {
  const clientIp = normalizeIp(req.ip);

  if (!ALLOWED_IPS.includes(clientIp)) {
    return res.status(403).json({ message: "이 IP에서는 접근할 수 없습니다." });
  }

  const applications = readApplications();
  return res.json(applications);
});

app.get("/admin", (req, res) => {
  const clientIp = normalizeIp(req.ip);

  if (!ALLOWED_IPS.includes(clientIp)) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <title>접근 불가</title>
        <style>
          body {
            background: #111;
            color: white;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .box {
            background: #1b1b1b;
            padding: 28px;
            border-radius: 18px;
            border: 1px solid #333;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>접근 불가</h1>
          <p>허용된 IP에서만 신청자 목록을 볼 수 있습니다.</p>
        </div>
      </body>
      </html>
    `);
    return;
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>신청자 목록</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #0d0d0d;
          color: #f4f4f4;
          padding: 24px;
        }
        .wrap {
          max-width: 1000px;
          margin: 0 auto;
        }
        .card {
          background: #171717;
          border: 1px solid #2d2d2d;
          border-radius: 22px;
          padding: 24px;
        }
        h1 {
          margin-top: 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 18px;
        }
        th, td {
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid #2e2e2e;
        }
        th {
          color: #cfcfcf;
        }
        .muted {
          color: #a8a8a8;
          margin-bottom: 14px;
        }
        button {
          background: white;
          color: black;
          border: none;
          border-radius: 12px;
          padding: 10px 16px;
          font-weight: 700;
          cursor: pointer;
          margin-bottom: 14px;
        }
        .small {
          color: #9a9a9a;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <h1>가입 신청자 목록</h1>
          <p class="muted">허용된 IP에서만 볼 수 있습니다.</p>
          <button onclick="loadData()">새로고침</button>
          <div id="content">불러오는 중...</div>
        </div>
      </div>

      <script>
        async function loadData() {
          const content = document.getElementById("content");

          try {
            const res = await fetch("/api/applications");
            const data = await res.json();

            if (!res.ok) {
              content.innerHTML = "<p>" + (data.message || "불러오기 실패") + "</p>";
              return;
            }

            if (!Array.isArray(data) || data.length === 0) {
              content.innerHTML = "<p>아직 신청자가 없습니다.</p>";
              return;
            }

            const rows = data.map((item, index) => {
              return \`
                <tr>
                  <td>\${index + 1}</td>
                  <td>\${item.playerName}</td>
                  <td>\${item.ip}</td>
                  <td>\${new Date(item.createdAt).toLocaleString("ko-KR")}</td>
                </tr>
              \`;
            }).join("");

            content.innerHTML = \`
              <table>
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>닉네임</th>
                    <th>신청 IP</th>
                    <th>신청 시간</th>
                  </tr>
                </thead>
                <tbody>\${rows}</tbody>
              </table>
              <p class="small">한 IP당 최대 2번까지 신청 가능</p>
            \`;
          } catch (e) {
            content.innerHTML = "<p>서버 오류가 발생했습니다.</p>";
          }
        }

        loadData();
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(\`서버 실행 중: http://localhost:\${PORT}\`);
});