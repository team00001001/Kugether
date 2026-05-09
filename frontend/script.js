const API_BASE_URL = "http://127.0.0.1:8000/api";

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

function joinProduct(productId, post, countSpan, button) {
  if (hasJoined(productId)) {
    alert('이미 참여하셨습니다.');
    return;
  }

  if (!confirm('정말로 이 공동구매에 참여하시겠습니까?')) {
    return;
  }

  incrementProductJoin(productId);
  setJoined(productId);

  const total = Number(post.people) + getJoinCount(productId);
  if (countSpan) {
    countSpan.textContent = total;
  }

  button.disabled = true;
  button.textContent = '참여 완료';
  alert('참여가 완료되었습니다!');
}

fetch(`${API_BASE_URL}/posts`)
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("product-list");

    data.forEach(post => {
      const cardLink = document.createElement("a");
      cardLink.href = `detail.html?id=${post.id}`;
      cardLink.className = "card-link";

      const card = document.createElement("article");
      card.className = "product-card";

      const totalPeople = Number(post.people) + getJoinCount(post.id);
      const joined = hasJoined(post.id);

      card.innerHTML = `
        <h2>${post.title}</h2>
        <p>${post.description}</p>
        <div class="card-info">
          <span class="join-count">${totalPeople}</span>
          <span>${post.deadline}</span>
        </div>
        <button type="button">${joined ? '참여 완료' : '참여하기'}</button>
      `;

      const button = card.querySelector('button');
      const countSpan = card.querySelector('.join-count');

      if (joined) {
        button.disabled = true;
      }

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        joinProduct(post.id, post, countSpan, button);
      });

      cardLink.appendChild(card);
      container.appendChild(cardLink);
    });
  })
  .catch(error => {
    console.error('상품 목록을 불러오는 중 오류가 발생했습니다.', error);
  });