# Theo dõi tài nguyên máy chủ

Trang `/diagnostics` chỉ dành cho quản trị viên, hiển thị số liệu từ hai endpoint độc lập:

| Máy chủ | Endpoint | Lấy mẫu CPU |
| --- | --- | --- |
| API Laravel | `GET /api/diagnostics/resources` | Chênh lệch bộ đếm trong cửa sổ thực tế khoảng 50 ms |
| WSS NestJS | `GET /diagnostics/resources` | Chênh lệch bộ đếm giữa các mẫu nền khoảng 1 giây |

Frontend đọc lại mỗi 5 giây khi tab đang hiển thị, không gửi chồng yêu cầu đến cùng máy chủ và hủy yêu cầu sau 10 giây. Khi lỗi, giữ mẫu gần nhất với nhãn **Mẫu cũ**; lỗi của một máy không ngăn máy còn lại cập nhật. Không chạy speedtest cho đến khi admin bấm bắt đầu.

## Ý nghĩa số đo

- **Container:** bộ đếm và giới hạn do cgroup của ứng dụng công bố. CPU tính theo thời gian CPU thực dùng chia thời gian lấy mẫu và số vCPU hiệu dụng; giới hạn này là mức trần, không phải cam kết CPU riêng. Có thể thấy mức trên 100% ở cửa sổ ngắn do burst/quota scheduling. RAM dùng bộ đếm cgroup, gồm cả các khoản bộ nhớ kernel tính vào nhóm, không chỉ heap của ứng dụng.
- **Máy host:** số đo hệ thống mà tiến trình nhìn thấy khi không đọc được bộ đếm container. Không coi tổng RAM hoặc số luồng host là phần tài nguyên riêng được cấp cho ứng dụng.
- **Filesystem:** dung lượng filesystem chứa thư mục ứng dụng/storage. Có thể dùng chung với tiến trình khác. Hạn mức riêng của gói hosting vẫn là `null` nếu không có nguồn đọc được; không thay bằng tổng dung lượng host.
- **Tiến trình:** RSS và thời gian chạy của worker/tiến trình phục vụ mẫu. `instance_id` giúp nhận biết các mẫu đến từ worker hoặc instance khác nhau.

Các trường không thể đo được trả về `null` và hiển thị **Không có dữ liệu**. Số liệu là ảnh chụp từ kernel/runtime tại thời điểm ghi trên thẻ; không phải phép đo liên tục hay chứng nhận cấu hình trong tài khoản nhà cung cấp. Cgroup v1 có bộ đếm bộ nhớ xấp xỉ theo cách kernel triển khai. Dung lượng được trình bày bằng đơn vị nhị phân; di chuột vào giá trị để xem byte gốc.

## Xác thực và triển khai

API dùng quyền admin của phiên tài khoản; WSS dùng phiên WSS còn hiệu lực với danh tính admin đang hoạt động. Phiên WSS dự phòng chỉ mở được diagnostics và chat khi API lỗi, không mở các trang quản trị nghiệp vụ khác. Trong lúc API đang xác thực, giao diện chờ kết quả thay vì chuyển qua lại trang đăng nhập.

Cần triển khai cả frontend, API và WSS để có đủ hai thẻ số liệu. Nếu backend chưa có endpoint mới, thẻ tương ứng hiển thị thông báo cần cập nhật máy chủ. Không cần biến môi trường mới hoặc khóa nhà cung cấp trên frontend.
