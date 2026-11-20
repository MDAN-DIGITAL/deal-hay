# Deal Hay frontend

Next.js App Router dùng cho giao diện và điều hướng, deploy trên Vercel. Chỉ trang chủ và chi tiết sản phẩm tải dữ liệu công khai trên server để phục vụ SEO. Trang shop và các trang tài khoản/nghiệp vụ dùng khung tĩnh, đọc tham số URL và tải dữ liệu trực tiếp trên trình duyệt; các thao tác tương tác gọi `deal-hay-api` qua HTTP, chat dùng `deal-hay-wss` qua Socket.IO. Dự án không chứa Server Actions, proxy backend hoặc WebSocket server. `robots.txt` và `sitemap.xml` là metadata routes của Next.js.

## Phát triển

Các lệnh local dùng Node.js 22.23.5, được khóa trong `.nvmrc`. Nếu chưa có phiên bản này, chạy `nvm install` từ thư mục dự án.

```sh
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Cấu hình public API trước khi chạy hoặc build:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Vercel dùng Root Directory `deal-hay`, preset Next.js và cùng biến `NEXT_PUBLIC_API_URL` trỏ tới API HTTPS thật. Biến này được đưa vào bundle khi build. Đổi địa chỉ cần build lại. `engines.node` chọn Node.js `22.x` cho build và Functions. Vercel tự quản lý các bản minor và patch. [Tài liệu phiên bản Node.js của Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

Đặt thêm `NEXT_PUBLIC_SITE_URL=https://ten-mien-chinh.example` cho origin canonical/sitemap. Nếu bỏ trống hoặc không hợp lệ, dùng `VERCEL_PROJECT_PRODUCTION_URL`, cuối cùng là `https://dealhay.vercel.app`. Hướng dẫn rà quảng cáo, nội dung công khai và bước gửi duyệt trong tài khoản Google: [adsense-readiness.md](docs/adsense-readiness.md).

Mở frontend local tại `http://localhost:3000` để dùng cùng hostname với API. API phải cho phép origin frontend trong CORS; WSS phải cho phép cùng origin đó. R2/S3 cần bucket CORS cho phép frontend upload bằng URL PUT có thời hạn. Khóa storage, khóa ký ticket và service secret chỉ cấu hình ở API/WSS.

## Luồng dữ liệu

- `src/api`: HTTP client dùng cookie phiên và gửi header `X-XSRF-TOKEN` khi ghi dữ liệu. API quyết định xác thực, phân quyền, giá, tồn kho và lưu dữ liệu nghiệp vụ.
- `src/modules`: UI và request handlers chạy trên browser; schema phía client hỗ trợ nhập liệu, API vẫn kiểm tra lại.
- `useApiQuery`: nhận snapshot SSR công khai nếu có, tiếp tục kiểm tra lại trên browser, xử lý loading/lỗi/retry, bỏ kết quả request đã cũ và cập nhật sau mutation.
- `SessionProvider`/`AuthGuard`: khôi phục người dùng qua `/api/auth/me`. Laravel đặt cookie phiên `HttpOnly`. Chọn **Ghi nhớ đăng nhập** để trình duyệt giữ cookie khi đóng. Ticket WSS chỉ sống trong bộ nhớ của trang, nên tải lại trang hoặc mở tab mới cần Laravel cấp ticket mới.
- Socket.IO và HTTP chat dùng phiên opaque do WSS lưu/xác thực trong SQLite. API bootstrap danh tính và dữ liệu chat ban đầu; FE ghi nhớ phiên WSS tối đa 24 giờ trên cùng trình duyệt, gắn với fingerprint của credential đăng nhập và kiểm tra hạn dùng trước khi sử dụng. Tab chat mới dùng lại phiên hợp lệ, kể cả khi mở bằng menu chuột phải, liên kết `noopener` hoặc thông báo. Reconnect, gửi tin, tải lịch sử, đánh dấu đã đọc và presence đi thẳng tới WSS, tiếp tục hoạt động khi API mất kết nối. Đăng nhập mới/cấp lại phiên hết hạn và mở cuộc trò chuyện từ nghiệp vụ sản phẩm vẫn cần API.
- Ảnh được resize/nén WebP trong browser và upload trực tiếp lên storage bằng URL có thời hạn. WSS cấp phiên upload ảnh/tệp chat và phục vụ attachment bằng credential WSS; file riêng tư hiển thị bằng object URL, thu hồi khi unmount. Các ảnh sản phẩm/avatar/review vẫn dùng API chính.
- Speedtest đo lần lượt DealHay Backend và DealHay WSS, hiển thị ping/jitter/download/upload riêng cho từng máy chủ. Mỗi máy chủ cấp grant ngay trước lượt đo của mình; phiên WSS đã xác thực cho phép mở chat và diagnostics khi API lỗi, riêng diagnostics vẫn yêu cầu quản trị viên. Không cấp quyền trang nghiệp vụ/quản trị khác bằng phiên dự phòng. Browser truyền dữ liệu trực tiếp tới máy chủ được đo; không cần thêm biến Vercel. Một máy chủ lỗi vẫn tiếp tục đo bên còn lại; lượt đo dùng nhiều luồng và không giới hạn tổng dữ liệu.
- Diagnostics lấy CPU/RAM/ổ đĩa/OS từ API và WSS độc lập mỗi 5 giây, tạm ngừng khi tab bị ẩn. Số liệu có thời điểm, cửa sổ lấy mẫu và phạm vi container/host/filesystem; chỉ admin được gọi endpoint. Không suy đoán hạn mức của gói hosting khi nhà cung cấp không công bố. Xem [server-resources.md](docs/server-resources.md).

## Khung chat và hỗ trợ

Trang `/chats` dùng giao diện riêng toàn màn hình, có tìm kiếm và lọc chưa đọc; nền sáng/tối trung tính, vùng tin nhắn và ô nhập cùng chiều rộng dễ đọc. Các liên kết mở trang tin nhắn và nút mở rộng khung nổi mở tab mới, giữ đúng tài khoản của tab nguồn và không đưa token vào URL. Chuyển cuộc trò chuyện bên trong trang chat vẫn dùng dữ liệu đã tải. Trên điện thoại, khung tự điều chỉnh theo bàn phím; nút `+` mở gửi ảnh/tệp và tag admin. Bong bóng ở góc dưới mọi trang mở cùng chức năng chat trong khung nổi; trên điện thoại khung này mở toàn màn hình. Thu nhỏ giữ cuộc trò chuyện, bản nháp và dữ liệu đã tải; tin mới chỉ được đánh dấu đã đọc khi khung đang mở. Các trang và form không tự kéo vị trí cuộn; khung chat vẫn cuộn theo tin nhắn mới.

**Deal Hay Admin** luôn đứng đầu danh sách, kể cả khi tìm kiếm. WSS tạo phòng hỗ trợ riêng với các tài khoản quản trị thật đang hoạt động; nếu chưa đồng bộ được quản trị viên, hàng hỗ trợ hiển thị chưa sẵn sàng. Người chưa đăng nhập có thể mở bong bóng và đăng nhập để bắt đầu.

WSS chỉ dùng SQLite trong RAM (`WSS_SQLITE_PATH=:memory:`); cấu hình từ chối đường dẫn file. Mỗi lần tiến trình khởi động lại sẽ mất tin chỉ lưu ở WSS, phiên WSS và đăng ký Web Push; frontend xin lại phiên WSS một lần khi credential cũ bị từ chối, nhưng không thể khôi phục lịch sử chưa lưu ở nơi khác. Xem [README WSS](../deal-hay-wss/README.md).

## Kiểm tra

Hệ giao diện dùng chung và quy tắc `components/ui`: [design-system.md](docs/design-system.md). Toàn bộ shadcn/ui đã được cài và tùy chỉnh theo phong cách chat; màu sắc dùng token toàn cục, các trang ghép từ primitive chung.

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Build cần `NEXT_PUBLIC_API_URL` hợp lệ; không cần API đang chạy. Trang chủ và chi tiết sản phẩm dùng GET công khai phía server, có thời hạn chờ và fallback. Các trang còn lại đọc query trên browser dưới `Suspense`, tránh chuyển route tĩnh thành SSR chỉ để truyền bộ lọc, tab hoặc phân trang. Các đường dẫn động như shop, chat và checkout có thể cần tạo khung theo đường dẫn, nhưng không tải dữ liệu nghiệp vụ trên server.

Hướng dẫn ảnh: [browser-image-uploads.md](../deal-hay-api/docs/browser-image-uploads.md). Realtime: [socketio-validation.md](docs/socketio-validation.md).
Upload nhiều ảnh: [image-upload-concurrency.md](docs/image-upload-concurrency.md).

## Âm thanh và thông báo nền

Bấm biểu tượng loa ở thanh đầu trang rồi chọn **Nghe thử** để nghe âm báo ba nốt của Deal Hay. Trình duyệt có thể yêu cầu một lần tương tác để phát âm báo. Cài đặt bật/tắt âm được lưu riêng cho từng tài khoản.

Để tiếp tục nhận thông báo khi trình duyệt tạm dừng hoặc đóng tab, cấu hình `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` ở WSS theo [hướng dẫn WSS](../deal-hay-wss/README.md), deploy cả WSS và frontend qua HTTPS, rồi bấm **Bật thông báo nền** và chọn **Cho phép**. Frontend lấy public key qua endpoint WSS có xác thực; private key chỉ nằm trên WSS. Không cần thêm biến VAPID vào Vercel. Sau khi thay cặp khóa, người dùng cần bật lại thông báo trên thiết bị.

Trên iPhone/iPad, thêm web vào **Màn hình chính**, mở ứng dụng từ biểu tượng vừa thêm rồi bật thông báo. Khi tab đã đóng hoặc trình duyệt tạm dừng trang, thông báo nền hiển thị dưới dạng thẻ im lặng. Âm báo Deal Hay phát khi trang còn chạy.

Service worker `/notification-worker.js` lưu tài khoản nhận Web Push và mã chống trùng. Đăng xuất hoặc tắt thông báo nền sẽ thu hồi liên kết cho Web Push ngay trên trình duyệt. Khi socket và Web Push nhận cùng một sự kiện, trang chỉ phát âm báo Deal Hay một lần.
