const SERVER_IP = "play.example.com";

document.getElementById("server-ip").textContent = SERVER_IP;

function copyIP() {
  navigator.clipboard.writeText(SERVER_IP)
    .then(() => {
      alert("서버 주소가 복사되었습니다: " + SERVER_IP);
    })
    .catch(() => {
      alert("복사에 실패했습니다.");
    });
}

function scrollToApply() {
  document.getElementById("apply").scrollIntoView({ behavior: "smooth" });
}

async function checkServer() {
  const statusEl = document.getElementById("server-status");

  try {
    const res = await fetch(`https://api.mcsrvstat.us/2/${SERVER_IP}`);
    const data = await res.json();

    if (data.online) {
      statusEl.textContent = `온라인 (${data.players.online}/${data.players.max})`;
    } else {
      statusEl.textContent = "오프라인";
    }
  } catch (e) {
    statusEl.textContent = "확인 실패";
  }
}

async function submitApplication(event) {
  event.preventDefault();

  const playerName = document.getElementById("playerName").value.trim();
  const messageEl = document.getElementById("apply-message");

  if (!playerName) {
    messageEl.textContent = "닉네임을 입력해주세요.";
    return;
  }

  try {
    const res = await fetch("/api/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ playerName })
    });

    const data = await res.json();

    if (res.ok) {
      messageEl.textContent = data.message || "신청이 완료되었습니다.";
      document.getElementById("apply-form").reset();
    } else {
      messageEl.textContent = data.message || "신청에 실패했습니다.";
    }
  } catch (err) {
    messageEl.textContent = "서버 연결 중 오류가 발생했습니다.";
  }
}

document.getElementById("apply-form").addEventListener("submit", submitApplication);

checkServer();