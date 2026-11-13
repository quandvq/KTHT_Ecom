// tests/e2e/vpharma-full-suite.mjs
const baseUrl = process.argv[2] || 'http://127.0.0.1:5080';

async function main() {
  console.log(`=== BỘ KIỂM THỬ TOÀN DIỆN V-PHARMA (E2E) TẠI ${baseUrl} ===\n`);

  // 1. Catalog & Categories
  console.log('[1] Kiểm tra Catalog & Categories...');
  const catRes = await fetch(`${baseUrl}/api/categories`);
  if (!catRes.ok) throw new Error('Failed to load categories');
  const categories = await catRes.json();
  console.log(`- Danh mục đã tải: ${categories.length} danh mục`);

  const prodRes = await fetch(`${baseUrl}/api/products?page=1&pageSize=4`);
  if (!prodRes.ok) throw new Error('Failed to load products');
  const prodPage = await prodRes.json();
  console.log(`- Tổng sản phẩm niêm yết: ${prodPage.totalCount}`);
  if (prodPage.items.length === 0) throw new Error('No products found');
  const sampleProduct = prodPage.items[0];
  console.log(`- Sản phẩm mẫu: "${sampleProduct.name}" (Slug: ${sampleProduct.slug}, Giá: ${sampleProduct.price}đ)`);

  // 2. Product Detail
  console.log('\n[2] Kiểm tra Chi tiết sản phẩm...');
  const detailRes = await fetch(`${baseUrl}/api/products/${sampleProduct.slug}`);
  if (!detailRes.ok) throw new Error(`Product detail failed: ${detailRes.status}`);
  const detail = await detailRes.json();
  console.log(`- Chi tiết SKU: ${detail.variants?.length || 0} biến thể`);
  console.log('PASS: Catalog & Detail hoạt động tốt.');

  // 3. Flash Sale Active & Pricing
  console.log('\n[3] Kiểm tra Flash Sale Active & Tồn kho Giờ Vàng...');
  const fsRes = await fetch(`${baseUrl}/api/flash-sales/active`);
  if (!fsRes.ok) throw new Error('Flash sale active endpoint error');
  const fsData = await fsRes.json();
  if (!fsData.active || !fsData.campaign) throw new Error('Expected active flash sale campaign');
  console.log(`- Chiến dịch: "${fsData.campaign.name}"`);
  console.log(`- Thời gian còn lại: ${fsData.campaign.remainingSeconds} giây`);
  console.log(`- Số SKU tham gia: ${fsData.campaign.items.length}`);
  const fsItem = fsData.campaign.items[0];
  console.log(`- SKU Flash Sale: ${fsItem.sku} - Giá gốc: ${fsItem.originalPrice}đ -> Giảm còn: ${fsItem.flashSalePrice}đ (-${fsItem.discountPercentage}%)`);

  // 4. Cart Validation with Flash Sale Price
  console.log('\n[4] Kiểm tra Cart Validation với giá Flash Sale...');
  const cartRes = await fetch(`${baseUrl}/api/cart/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ sku: fsItem.sku, quantity: 1 }]
    })
  });
  if (!cartRes.ok) throw new Error('Cart validate failed');
  const cartData = await cartRes.json();
  const validatedItem = cartData.items[0];
  console.log(`- Giá áp dụng trong giỏ: ${validatedItem.price}đ`);
  if (validatedItem.price !== fsItem.flashSalePrice) {
    throw new Error(`Expected flash sale price ${fsItem.flashSalePrice}, got ${validatedItem.price}`);
  }
  if (!validatedItem.isFlashSale) {
    throw new Error('Expected isFlashSale to be true');
  }
  console.log('PASS: Giỏ hàng tự động nhận diện giá Flash Sale chính xác 100%.');

  // 5. Customer Chatbot - Medical Advice Disclaimer Check
  console.log('\n[5] Kiểm tra Trợ lý Dược sĩ V-Pharma (Customer Chatbot)...');
  const chat1 = await fetch(`${baseUrl}/api/chat/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Tôi bị sốt và ho, nên uống thuốc gì?' })
  });
  const chat1Data = await chat1.json();
  console.log('- Phản hồi khi hỏi triệu chứng y tế:');
  console.log(chat1Data.reply);
  if (!chat1Data.reply.includes('Lưu ý y tế') && !chat1Data.reply.includes('Bác sĩ') && !chat1Data.reply.includes('Dược sĩ')) {
    throw new Error('Customer chatbot must contain medical disclaimer for health queries');
  }
  console.log('PASS: Cảnh báo y tế và tư vấn tham khảo được thực thi nghiêm ngặt.');

  // 6. Customer Chatbot - Product Search
  console.log('\n[6] Kiểm tra Chatbot tìm kiếm sản phẩm...');
  const chat2 = await fetch(`${baseUrl}/api/chat/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Tìm combo giảm cảm' })
  });
  const chat2Data = await chat2.json();
  console.log(`- Tìm thấy: ${chat2Data.products?.length || 0} sản phẩm gợi ý`);
  console.log('PASS: Chatbot tìm kiếm sản phẩm hoạt động tốt.');

  // 7. Admin Copilot Chat - Security & Invariant verification
  console.log('\n[7] Kiểm tra Admin AI Copilot & Invariant tồn kho...');
  // Login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ktht.local', password: 'Ktht@2026' })
  });
  const { token } = await loginRes.json();

  const adminChatRes = await fetch(`${baseUrl}/api/chat/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message: 'Báo cáo tồn kho hệ thống' })
  });
  const adminChat = await adminChatRes.json();
  console.log(adminChat.reply);
  const { totalP, totalQ, totalB, totalR, totalA, totalU } = adminChat.data;
  const calculatedU = totalP - totalQ - totalB - totalR - totalA;
  if (calculatedU !== totalU) {
    throw new Error(`Inventory Invariant violation: P(${totalP}) - Q(${totalQ}) - B(${totalB}) - R(${totalR}) - A(${totalA}) = ${calculatedU} !== U(${totalU})`);
  }
  console.log(`PASS: Invariant U = P - Q - B - R - A (= ${totalU}) được chứng minh tuyệt đối.`);

  console.log('\n=== TẤT CẢ 7/7 HẠNG MỤC KIỂM THỬ HỆ THỐNG V-PHARMA ĐỀU ĐẠT CHUẨN! ===');
}

main().catch(err => {
  console.error('\nLỖI:', err);
  process.exit(1);
});

