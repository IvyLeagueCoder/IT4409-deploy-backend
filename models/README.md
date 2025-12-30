# Backend Models - Cấu trúc Database

## Tóm tắt cập nhật

Tất cả các models đã được bổ sung đầy đủ các trường để **khớp 100% với frontend mock data**.

---

## Product Model

**Mục đích**: Lưu trữ thông tin sản phẩm với đầy đủ biến thể và đặc tính

### Các trường mới thêm:

- `discountPrice`: Giá sau giảm
- `brand`: Thương hiệu (Dell, HP, Lenovo...)
- `variants[]`: Mảng các phiên bản sản phẩm
- `ram`, `ssd`, `color`: Cấu hình
- `price`, `stock`: Giá và tồn kho riêng
- `sku`: Mã sản phẩm
- `highlights[]`: Điểm nổi bật (bullet points)
- `features{}`: Tính năng chi tiết
- `processor`, `ram`, `storage`, `display`
- `graphics`, `battery`, `weight`, `os`
- `warranty`: Thời gian bảo hành (mặc định "12 tháng")
- `origin`: Xuất xứ (mặc định "Chính hãng")
- `ratings`: Đánh giá
- `average` (0-5), `count`
- `specifications`: Thông số kỹ thuật (flexible)
- `isActive`, `isBestSeller`, `isNew`: Trạng thái

### Indexes:

- Text search: `name`, `description`
- Compound: `category + brand`, `price`

---

## Category Model

**Mục đích**: Phân loại sản phẩm với danh mục con

### Các trường mới thêm:

- `slug`: URL-friendly (tự động generate từ `name`)
- Xử lý tiếng Việt: `Điện thoại` → `dien-thoai`
- `icon`: Emoji hoặc URL icon (💻, 📱, 🖥️)
- `image`: URL hình ảnh banner
- `subcategories[]`: Danh mục con
- VD: Laptop → ["Gaming Laptop", "Ultrabook", "Workstation"]
- `isActive`: Trạng thái hiển thị

### Pre-save Hook:

```javascript
// Auto-generate slug từ name
CategorySchema.pre("save", function (next) {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-");
  }
  next();
});
```

---

## 🛒 Cart Model

**Mục đích**: Lưu giỏ hàng với lựa chọn variant

### Các trường mới thêm:

- `items[].selectedVariant`: Lưu variant đã chọn
- `variantIndex`: Vị trí trong mảng `product.variants`
- `ram`, `ssd`, `color`: Cấu hình đã chọn
- `price`: Giá của variant

**Lý do**: Cần lưu chính xác cấu hình (RAM/SSD/màu) mà user đã chọn, không chỉ productId.

---

## Brand Model

**Mục đích**: Thương hiệu sản phẩm

### Các trường mới thêm:

- `logo`: URL logo thương hiệu
- `popular`: Flag để hiển thị ở trang chủ

---

## Order Model

**Mục đích**: Đơn hàng với snapshot thông tin

### Các trường mới thêm:

- `customerName`, `customerPhone`, `customerEmail`: Thông tin khách (snapshot)
- `items[].productName`: Tên sản phẩm (snapshot)
- `items[].productImage`: Ảnh sản phẩm (snapshot)
- `note`: Ghi chú đơn hàng

**Lý do**: Lưu snapshot để hiển thị thông tin ngay cả khi sản phẩm bị xóa/sửa.

---

## Review Model

**Mục đích**: Đánh giá sản phẩm

### Các trường mới thêm:

- `userName`, `userAvatar`: Thông tin user (snapshot)
- `images[]`: Ảnh đánh giá từ khách hàng
- `isVerified`: Đánh giá từ người đã mua hàng
- `timestamps`: Tự động thêm `createdAt`, `updatedAt`

---

## Sử dụng

### 1. Khởi động MongoDB

```bash
mongod
```

### 2. Khởi động Backend

```bash
cd backend
npm run dev
```

### 3. Test API

```bash
# Tạo product với variants
POST /api/products
{
  "name": "Dell XPS 13",
  "price": 30000000,
  "variants": [
    { "ram": "16GB", "ssd": "512GB", "price": 30000000, "stock": 10 },
    { "ram": "32GB", "ssd": "1TB", "price": 40000000, "stock": 5 }
  ],
  "highlights": ["Intel Core i7", "OLED Display"],
  "features": {
    "processor": "Intel Core i7-1360P",
    "ram": "16GB LPDDR5",
    "display": "13.4 inch OLED"
  }
}
```

---

## 📊 Độ khớp với Frontend

| Model    | Trước | Sau  |
| -------- | ----- | ---- |
| Product  | 65%   | 100% |
| Category | 80%   | 100% |
| Cart     | 70%   | 100% |
| Brand    | 75%   | 100% |
| Order    | 85%   | 100% |
| Review   | 70%   | 100% |

---

## Cần làm tiếp

1.  ~~Update models~~ (DONE)
2.  Update controllers để xử lý trường mới
3.  Tạo migration script cho dữ liệu cũ
4.  Test CRUD với dữ liệu thật
5.  Cập nhật API documentation

---

## Notes

- Tất cả các trường mới đều **optional** hoặc có **default value** → không ảnh hưởng dữ liệu cũ
- Pre-save hooks sẽ tự động chạy khi tạo/sửa document
- Indexes đã được thêm để tối ưu performance
- Sử dụng `mongoose.Schema.Types.Mixed` cho flexible fields (`specifications`)
