const API_BASE_URL = "http://127.0.0.1:8000/api";
const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

function getJoinedCounts() {
  return JSON.parse(localStorage.getItem('joinedGroupCounts') || '{}');
}

function getJoinedProducts() {
  return JSON.parse(localStorage.getItem('joinedGroupIds') || '[]');
}

function saveJoinedCounts(counts) {
  localStorage.setItem('joinedGroupCounts', JSON.stringify(counts));
}

function saveJoinedProducts(ids) {
  localStorage.setItem('joinedGroupIds', JSON.stringify(ids));
}

function getJoinCount(productId) {
  const counts = getJoinedCounts();
  return counts[String(productId)] || 0;
}

function hasJoined(productId) {
  const ids = getJoinedProducts();
  return ids.includes(String(productId));
}

function setJoined(productId) {
  const ids = getJoinedProducts();
  const idStr = String(productId);
  if (!ids.includes(idStr)) {
    ids.push(idStr);
    saveJoinedProducts(ids);
  }
}

function incrementProductJoin(productId) {
  const counts = getJoinedCounts();
  const idStr = String(productId);
  counts[idStr] = (counts[idStr] || 0) + 1;
  saveJoinedCounts(counts);
  return counts[idStr];
}

function joinProduct(post) {
  if (hasJoined(post.id)) {
    alert('이미 참여하셨습니다.');
    return;
  }

  if (!confirm('정말로 이 공동구매에 참여하시겠습니까?')) {
    return;
  }

  incrementProductJoin(post.id);
  setJoined(post.id);

  const currentPeople = Number(post.people) + getJoinCount(post.id);
  const peopleSpan = document.querySelector('.join-count');
  if (peopleSpan) {
    peopleSpan.textContent = currentPeople;
  }

  const joinBtn = document.getElementById('join-btn');
  if (joinBtn) {
    joinBtn.disabled = true;
    joinBtn.textContent = '참여 완료';
  }

  alert('참여가 완료되었습니다!');
}

fetch(`${API_BASE_URL}/posts/${postId}`)
  .then(res => res.json())
  .then(post => {
    const detailCard = document.getElementById("detail-card");
    const savedCount = getJoinCount(post.id);
    const totalPeople = Number(post.people) + savedCount;
    const joined = hasJoined(post.id);

    detailCard.innerHTML = `
      <h1>${post.title}</h1>
      <p class="description">${post.description}</p>

      <div class="detail-info">
        <p><strong>참여 인원:</strong> <span class="join-count">${totalPeople}</span></p>
        <p><strong>마감:</strong> ${post.deadline}</p>
        <p><strong>가격:</strong> ${post.price}</p>
        <p><strong>거래 장소:</strong> ${post.place}</p>
      </div>

      <button id="join-btn" class="join-btn" type="button">${joined ? '참여 완료' : '참여하기'}</button>
    `;

    const joinBtn = document.getElementById('join-btn');
    if (joined) {
      joinBtn.disabled = true;
    }

    joinBtn.addEventListener('click', () => joinProduct(post));
  })
  .catch(error => {
    console.error('상품 상세를 불러오는 중 오류가 발생했습니다.', error);
  });