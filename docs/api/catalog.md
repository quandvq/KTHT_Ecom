# Catalog public — contract TASK-008

Contract C01–C03, không có API quản trị/tồn kho. Demo lưu SQL Server; FE đọc API. docs/source chưa có nguồn KTHT nên catalog là baseline demo.

- GET /api/categories: mảng {id,name,slug}.
- GET /api/products: q, category (slug), sort (featured|name|price-asc|price-desc), page (default 1), pageSize (default 12, 1–100), featured (bool tùy chọn), minPrice/maxPrice (decimal tùy chọn).
- Response: {items:[{id,name,slug,sku,price,imageUrl,category:{id,name,slug},isFeatured}],page,pageSize,totalCount}.
- GET /api/products/{slug}: {id,name,slug,description,imageUrl,category:{id,name,slug},variants:[{id,sku,name,price,imageUrl,isActive}]}.

Ảnh nullable; FE có placeholder rõ. SKU/giá danh sách cùng thuộc variant hoạt động rẻ nhất (tie ID); filter giá/sort dùng giá này. Chỉ sản phẩm published có SKU hoạt động; chi tiết chỉ trả variant hoạt động. isActive là niêm yết, không chứng minh còn hàng. Không trả P/Q/B/R/A/U/quota. Giá decimal(18,2), hiển thị VND; chưa tính tổng/thu tiền.

Query sai: 400 ValidationProblem; page ngoài kết quả: items rỗng; category không tồn tại: rỗng. Slug thiếu/unpublished: 404. Phân trang có khóa phụ ID ổn định. Không hardcode sản phẩm FE.

Migration bổ sung category, slug/mô tả/featured và variants; bảo toàn Product cũ, backfill SKU/giá sang variant. Seed lặp không nhân đôi, không reset DB.
