# Deal Hay frontend

Next.js App Router dùng cho giao diện và điều hướng, deploy trên Vercel. Trình duyệt gọi trực tiếp `deal-hay-api` qua HTTP và `deal-hay-wss` qua Socket.IO. Dự án không chứa Server Actions, API routes, proxy backend hoặc WebSocket server.

## Phát triển

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Cấu hình public API trước khi chạy hoặc build:

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

Vercel dùng Root Directory `deal-hay`, preset Next.js và cùng biến `NEXT_PUBLIC_API_URL` trỏ tới API HTTPS thật. Biến này được đưa vào bundle khi build; đổi địa chỉ cần build lại. Không cần Docker hoặc Render cho frontend.

API phải cho phép origin frontend trong CORS; WSS phải cho phép cùng origin đó. R2/S3 cần bucket CORS cho phép frontend upload bằng URL PUT có thời hạn. Khóa storage, khóa ký ticket và service secret chỉ cấu hình ở API/WSS.

## Luồng dữ liệu

- `src/api`: HTTP client dùng bearer token, route và kiểu dữ liệu API. API quyết định xác thực, phân quyền, giá, tồn kho và lưu dữ liệu nghiệp vụ.
- `src/modules`: UI và request handlers chạy trên browser; schema phía client hỗ trợ nhập liệu, API vẫn kiểm tra lại.
- `useApiQuery`: tải dữ liệu trên browser, xử lý loading/lỗi/retry, bỏ kết quả request đã cũ và cập nhật sau mutation.
- `SessionProvider`/`AuthGuard`: lấy user từ API. Token lưu trong `sessionStorage`, giữ qua reload cùng tab và được xóa khi đăng xuất hoặc API trả 401 cho phiên hiện tại. Token không được ghi vào cookie hoặc URL. Phiên gắn với tab; dữ liệu phân quyền luôn do API xác nhận.
- Socket.IO dùng ticket ngắn hạn riêng, tự đổi ticket/reconnect và khôi phục subscriptions. API tiếp tục lưu tin nhắn và phát sự kiện sang WSS.
- Ảnh được resize/nén WebP trong browser và upload trực tiếp lên storage bằng URL có thời hạn. File chat riêng tư được tải từ API với bearer token và hiển thị bằng object URL, thu hồi khi unmount.
- Speedtest đổi bearer token lấy grant giới hạn, rồi đo trực tiếp tới API. Frontend không chuyển tiếp lưu lượng đo.

## Kiểm tra

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Build cần `NEXT_PUBLIC_API_URL` hợp lệ; không cần API đang chạy vì dữ liệu được tải sau khi browser mount. Các page/layout server chỉ tạo khung giao diện, metadata và tham số điều hướng.

Hướng dẫn ảnh: [browser-image-uploads.md](../deal-hay-api/docs/browser-image-uploads.md). Realtime: [socketio-validation.md](docs/socketio-validation.md).
