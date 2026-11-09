// 入會申請系統設定（官網申請表 index.html 與入會後台 member-admin.html 共用）
// API_URL：Google Apps Script「入會申請系統」部署成網頁應用程式後的 /exec 網址
window.HCD_MEMBER = {
  API_URL: "https://script.google.com/macros/s/AKfycbymeqPCKidX9RQMw24nbE-5hrqaxLaNEWVLPLKcmYxrG3pnvTOYEknYhiHRsWY4nMqmKA/exec",
  ORG: "新竹市無人機創新科技協會",
  PHONE: "03-540-3463",
  // 入會審核後台的 Google 登入（Google Cloud 專案 hsinchu-drone，和社區報名後台同一組）；誰能登入在 Apps Script 的 ADMIN_EMAILS
  GOOGLE_CLIENT_ID: "944428960229-mr558fj6iq5vkccft3mpnm5uf484m6cb.apps.googleusercontent.com"
};
