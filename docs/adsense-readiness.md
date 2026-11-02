# Kiểm tra AdSense cho Deal Hay

Ảnh “Your account wasn't approved” chỉ là thông báo chung. [Hướng dẫn của Google](https://support.google.com/adsense/answer/81904?hl=en) yêu cầu xem chi tiết trong AdSense hoặc email để biết lý do cụ thể. Sửa mã nguồn không bảo đảm tài khoản sẽ được duyệt; không tự xác nhận tài khoản trùng, chất lượng nội dung hay nguồn truy cập khi chưa có bằng chứng.

## Các vấn đề đã kiểm tra

Ở lần kiểm tra ngày 03/11/2026, HTML công khai của trang chủ production chỉ có khung trang và lựa chọn cookie, chưa có nội dung catalog trước khi JavaScript tải dữ liệu. Home, shop và sản phẩm cần có dữ liệu công khai trong HTML server; trình duyệt tiếp tục gọi API cho phần tương tác và trạng thái tài khoản. Không đưa dữ liệu riêng tư hoặc bearer token vào HTML hay cache công khai.

AdSense trước đây được khởi tạo từ layout storefront, bao gồm cả bước checkout và khi nội dung còn loading/lỗi/trống. Chỉ khởi tạo quảng cáo trên trang có nội dung công khai phù hợp. Checkout và các màn hình tài khoản, quản trị, chat không chạy publisher script. Với script đã tải, việc bỏ component khỏi DOM không hủy mã của nhà cung cấp; chuyển giữa khu vực có/không có AdSense cần kiểm tra document thực tế. [Google Publisher Policies](https://support.google.com/adsense/answer/10502938) có yêu cầu về nội dung màn hình, vị trí quảng cáo và tương tác người dùng.

`/ads.txt` đã trả HTTP 200 với publisher `pub-7303400269186048`, khớp metadata và tài khoản trong ảnh. Không sửa publisher ID để thử vượt qua xét duyệt. `robots.txt` và `sitemap.xml` hỗ trợ khám phá các URL công khai; chúng không thay thế nội dung gốc, không bảo đảm index và không cấp quyền truy cập vào trang riêng tư.

## Cấu hình và kiểm tra deploy

Đặt `NEXT_PUBLIC_SITE_URL=https://ten-mien-chinh.example` cho domain chính trên Vercel. Giá trị phải là origin HTTP(S), không tài khoản/mật khẩu, đường dẫn, query hoặc fragment. Khi không có giá trị hợp lệ, hệ thống thử `VERCEL_PROJECT_PRODUCTION_URL`, sau đó dùng `https://dealhay.vercel.app`. Các canonical URL và sitemap dùng origin này, không dùng Host header từ request.

Sau deploy, kiểm tra:

1. Mở View source của trang chủ, một shop và một sản phẩm thật: phải thấy tên/mô tả nội dung công khai, không chỉ skeleton. Kiểm tra khi API lỗi vẫn có màn hình lỗi rõ ràng, không có quảng cáo trên nội dung lỗi/trống.
2. Kiểm tra `/ads.txt`, `/robots.txt`, `/sitemap.xml` qua HTTPS và domain đã đăng ký trong AdSense. Sitemap chỉ lấy shop/sản phẩm từ public API bằng GET không token, không bịa URL hoặc ngày cập nhật. Giới hạn mỗi lượt: 4 giây, tối đa 50 trang catalog và 32 request shop, xử lý từng nhóm 4 request; API lỗi thì giữ các URL đã xác minh và các trang tĩnh công khai. Với catalog lớn hơn giới hạn này, cần endpoint sitemap riêng hoặc chia sitemap để khám phá đầy đủ hơn.
3. Thử cả vào thẳng checkout và đi từ sản phẩm sang checkout: document checkout không chứa script AdSense. Chat và các màn hình riêng tư cũng không chứa script này. Quảng cáo có thưởng GPT chỉ chạy sau lựa chọn rõ ràng của người dùng.
4. Kiểm tra nội dung sản phẩm thật, liên kết còn hoạt động, nguồn/quyền sử dụng hình ảnh và nội dung. Không thêm bài viết hoặc dữ liệu giả chỉ để làm dày website. [Google hướng dẫn chuẩn bị trang cho AdSense](https://support.google.com/adsense/answer/7299563?hl=en) nhấn mạnh nội dung gốc, có giá trị và điều hướng rõ ràng.

## Việc cần làm trong tài khoản Google

- Đọc email từ chối và chi tiết tài khoản/site để xử lý đúng lý do. Nếu Google báo tài khoản trùng, xử lý tài khoản theo hướng dẫn của Google; đổi code website không giải quyết việc này.
- Với quảng cáo cá nhân hóa cho EEA, UK hoặc Switzerland, xác minh **Privacy & messaging** hoặc CMP bên thứ ba đã được Google chứng nhận và tích hợp TCF. Hộp lựa chọn cookie tự viết không tự trở thành CMP được chứng nhận. Cấu hình CMP có thể nằm trong tài khoản Google, vì vậy chỉ rà source chưa xác minh được toàn bộ trạng thái này. Xem [yêu cầu CMP của Google](https://support.google.com/adsense/answer/13554116?hl=en).
- AdSense publisher ID và ad unit có thưởng Google Ad Manager là hai cấu hình khác nhau. Xác minh đúng ad unit/network trong tài khoản Ad Manager trước khi bật reward. Luồng thưởng phải tự nguyện, nêu rõ điều kiện, không yêu cầu click quảng cáo và vẫn cho người dùng tiếp tục mua hàng khi bỏ qua. [Chính sách quảng cáo có thưởng](https://support.google.com/adsense/answer/9121589?hl=en) có yêu cầu riêng về loại thưởng và tính không chuyển nhượng.
- Sau khi deploy và kiểm tra nội dung/cấu hình thực tế, người quản lý tài khoản mới đánh dấu xác nhận chính sách và bấm **Resubmit** trong AdSense. Repo không tự thao tác xác nhận hoặc gửi duyệt thay người quản lý. Quyết định duyệt thuộc Google.
