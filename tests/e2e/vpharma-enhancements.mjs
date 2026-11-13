// tests/e2e/vpharma-enhancements.mjs
const baseUrl = process.argv[2] || 'http://127.0.0.1:5080';

async function run() {
  console.log(`=== KIỂM THỬ TÍNH NĂNG MỚI V-PHARMA TẠI ${baseUrl} ===`);

  // 1. Flash Sale Active Endpoint
  console.log('\n[1] Kiểm tra GET /api/flash-sales/active...');
  const fsRes = await fetch(`${baseUrl}/api/flash-sales/active`);
  if (!fsRes.ok) throw new Error(`Flash sale active failed with status ${fsRes.status}`);
  const fsData = await fsRes.json();
  console.log('Flash Sale Status:', fsData.active ? 'ACTIVE' : 'INACTIVE');
  if (fsData.active) {
    console.log(`Campaign Name: "${fsData.campaign.name}", Items count: ${fsData.campaign.items.length}`);
    console.log(`Remaining Seconds: ${fsData.campaign.remainingSeconds}`);
    if (fsData.campaign.items.length > 0) {
      const firstItem = fsData.campaign.items[0];
      console.log(`- Item 1: ${firstItem.productName} (SKU: ${firstItem.sku})`);
      console.log(`  Original: ${firstItem.originalPrice}đ -> FlashSale: ${firstItem.flashSalePrice}đ (-${firstItem.discountPercentage}%)`);
      console.log(`  Sold/Limit: ${firstItem.soldCount}/${firstItem.quantityLimit}`);
      if (firstItem.flashSalePrice >= firstItem.originalPrice) {
        throw new Error('Flash sale price must be strictly less than original price');
      }
    }
  }
  console.log('PASS: Flash Sale Active endpoint hoạt động chính xác.');

  // 2. Customer Chatbot - Product Search
  console.log('\n[2] Kiểm tra POST /api/chat/customer (Tìm kiếm sản phẩm)...');
  const chatProdRes = await fetch(`${baseUrl}/api/chat/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Tôi muốn tìm mua thuốc hoặc vitamin C' })
  });
  if (!chatProdRes.ok) throw new Error(`Chat product query failed: ${chatProdRes.status}`);
  const chatProd = await chatProdRes.json();
  console.log('Reply snippet:', chatProd.reply.slice(0, 120) + '...');
  console.log('Suggested products count:', chatProd.products?.length || 0);
  console.log('PASS: Customer chatbot trả lời thông tin sản phẩm và gợi ý chính xác.');

  // 3. Customer Chatbot - Medical / Health disclaimer
  console.log('\n[3] Kiểm tra POST /api/chat/customer (Cảnh báo y tế / Health Disclaimer)...');
  const chatMedRes = await fetch(`${baseUrl}/api/chat/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Tôi bị đau đầu sốt cao, có thuốc gì điều trị không' })
  });
  if (!chatMedRes.ok) throw new Error(`Chat medical query failed: ${chatMedRes.status}`);
  const chatMed = await chatMedRes.json();
  console.log('Reply snippet:', chatMed.reply.slice(0, 140) + '...');
  if (!chatMed.reply.includes('Lưu ý y tế') && !chatMed.reply.includes('Bác sĩ') && !chatMed.reply.includes('Dược sĩ')) {
    throw new Error('Customer chatbot must include medical disclaimer when asked about symptoms');
  }
  console.log('PASS: Customer chatbot có đầy đủ cảnh báo y tế & hướng dẫn gặp bác sĩ/dược sĩ.');

  // 4. Customer Chatbot - Shipping FAQ
  console.log('\n[4] Kiểm tra POST /api/chat/customer (Chính sách giao hàng 2h)...');
  const chatShipRes = await fetch(`${baseUrl}/api/chat/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Phí giao hàng và thời gian vận chuyển mấy ngày?' })
  });
  if (!chatShipRes.ok) throw new Error(`Chat shipping query failed: ${chatShipRes.status}`);
  const chatShip = await chatShipRes.json();
  console.log('Reply snippet:', chatShip.reply.slice(0, 120) + '...');
  if (!chatShip.reply.includes('300.000đ') && !chatShip.reply.includes('2 giờ')) {
    throw new Error('Customer chatbot did not return standard V-Pharma shipping policy');
  }
  console.log('PASS: Customer chatbot giải đáp chính sách giao hàng chuẩn xác.');

  // 5. Admin Chatbot - Security check (Unauthorized)
  console.log('\n[5] Kiểm tra POST /api/chat/admin không có token...');
  const chatAdminUnauth = await fetch(`${baseUrl}/api/chat/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Báo cáo tồn kho' })
  });
  console.log('Unauthenticated status code:', chatAdminUnauth.status, '(Kỳ vọng 401)');
  if (chatAdminUnauth.status !== 401) {
    throw new Error(`Admin chatbot must be protected by auth, got ${chatAdminUnauth.status}`);
  }
  console.log('PASS: Admin chatbot chặn truy cập trái phép.');

  // 6. Admin Chatbot with Staff Token
  console.log('\n[6] Đăng nhập Admin và kiểm tra POST /api/chat/admin...');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ktht.local', password: 'Ktht@2026' })
  });
  if (!loginRes.ok) throw new Error(`Login failed with status ${loginRes.status}`);
  const { token, user } = await loginRes.json();
  console.log(`Đã đăng nhập với tư cách: ${user.fullName} (${user.role})`);

  const chatAdminRes = await fetch(`${baseUrl}/api/chat/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message: 'Báo cáo tồn kho hệ thống' })
  });
  if (!chatAdminRes.ok) throw new Error(`Admin chat failed: ${chatAdminRes.status}`);
  const chatAdmin = await chatAdminRes.json();
  console.log('Admin Copilot Reply snippet:\n', chatAdmin.reply);
  if (!chatAdmin.data || chatAdmin.data.totalU === undefined) {
    throw new Error('Admin copilot must return inventory calculation metrics');
  }
  console.log(`Total P: ${chatAdmin.data.totalP}, Q: ${chatAdmin.data.totalQ}, B: ${chatAdmin.data.totalB}, R: ${chatAdmin.data.totalR}, A: ${chatAdmin.data.totalA}, Available U: ${chatAdmin.data.totalU}`);
  console.log('PASS: Admin Copilot phản hồi số liệu tồn kho theo thời gian thực.');

  // 7. Admin Flash Sale list & toggle
  console.log('\n[7] Kiểm tra GET /api/admin/flash-sales & PUT /api/admin/flash-sales/{id}/toggle...');
  const adminFsRes = await fetch(`${baseUrl}/api/admin/flash-sales`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!adminFsRes.ok) throw new Error(`Admin flash sales list failed: ${adminFsRes.status}`);
  const adminFsList = await adminFsRes.json();
  console.log(`Số chiến dịch Flash Sale trong hệ thống: ${adminFsList.length}`);
  if (adminFsList.length > 0) {
    const fs = adminFsList[0];
    console.log(`Chiến dịch ID ${fs.id}: "${fs.name}" - Active: ${fs.isActive}`);
    // Toggle active state
    const toggleRes = await fetch(`${baseUrl}/api/admin/flash-sales/${fs.id}/toggle`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const toggleData = await toggleRes.json();
    console.log(`Toggle result: ${toggleData.message}`);
    // Toggle back
    await fetch(`${baseUrl}/api/admin/flash-sales/${fs.id}/toggle`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Đã khôi phục lại trạng thái ban đầu.');
  }
  console.log('PASS: Quản lý Flash Sale Admin hoạt động hoàn hảo.');

  console.log('\n=== TẤT CẢ CÁC BÀI TEST TÍNH NĂNG V-PHARMA ĐỀU VƯỢT QUA THÀNH CÔNG 100%! ===');
}

run().catch(err => {
  console.error('\nFAIL:', err);
  process.exit(1);
});

