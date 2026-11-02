# Giao diện Deal Hay

Phong cách của trang chat là hệ giao diện chung: nền trung tính sáng/tối, nội dung nằm trên thẻ có viền nhẹ, màu cam dành cho hành động và trạng thái đang chọn. `src/app/globals.css` là nguồn token duy nhất, bao gồm màu, bo góc và biểu đồ; không khai báo lại bảng màu ở từng trang.

## Component dùng chung

Mọi control và cách trình bày bề mặt được định nghĩa trong `src/components/ui`. Các component trong `modules` chỉ ghép dữ liệu nghiệp vụ, xử lý sự kiện và bố cục responsive từ những primitive này.

| Nhu cầu | Component |
| --- | --- |
| Nút, link dạng nút, bộ lọc | `Button`, `buttonVariants`, variant `filter` |
| Ô nhập, tìm kiếm, soạn tin | `Input`, `Textarea`, `InputGroup` variant `search`/`composer` |
| Chọn ngày, ngày và giờ | `DatePicker`, prop `withTime` để chọn cả giờ/phút; ghép `Calendar` + `Popover` + `Select`, không dùng picker native |
| Checkbox và lựa chọn | `Checkbox`, `RadioGroup`, `Select`, `NativeSelect`, `Combobox` |
| Thẻ nội dung có tiêu đề | `Card` và các phần `CardHeader`, `CardContent`, `CardFooter`; hoặc `Section` |
| Khung nhỏ, form, hàng danh sách | `Surface` với variant `default`, `muted`, `inset`, `dashed`, `danger` |
| Chỉ số tổng quan | `StatCard`; `compact` cho hàng chỉ số trên mobile |
| Tiêu đề trang, thương hiệu | `PageHeading`, `Brand` |
| Hàng tương tác | `Item` variant `interactive`, prop `selected` |
| Tình trạng | `Badge` variant `success`, `warning`, `info`, `destructive` |
| Tin nhắn và trích dẫn | `Message`, `MessageBubble`, `MessageQuote` |
| Modal, khung trượt, chat nổi | `Dialog`, `DialogContent`, `DialogPopup`, `Sheet`, `Drawer` |
| Danh sách dài và phân trang | `Table`, `ScrollArea`, `Pagination` |
| Loading, trống, lỗi | `Skeleton`, `Spinner`, `Empty`, `Alert` |

`Surface` hỗ trợ `render` để giữ nguyên thẻ HTML ngữ nghĩa (`form`, `article`, `li`, `dl`...) cùng handler. Các thẻ `section`, `main`, `nav`, lưới, khoảng cách và responsive layout vẫn thuộc trang; không tạo một kiểu nút/thẻ/ô nhập riêng trong trang.

Nút mặc định, input và select cao 40px. Ô nhập giữ chữ 16px trên điện thoại để tránh zoom khi focus. Màu `action` và `action-foreground` dành cho nút chính và tin nhắn gửi; màu `primary` dành cho link, icon và điểm nhấn, tự điều chỉnh độ tương phản ở giao diện tối.

`DatePicker` dùng [cách ghép Calendar và Popover của shadcn](https://ui.shadcn.com/docs/components/base/date-picker), hiển thị tiếng Việt và chọn giờ/phút bằng `Select` khi có `withTime`. Prop `value`/`defaultValue` và giá trị form qua `name` có dạng local `YYYY-MM-DD` hoặc `YYYY-MM-DDTHH:mm`; giá trị rỗng là `""`. Chỉ đổi sang ISO UTC ở bước gửi API bằng helper ngày giờ, không cắt chuỗi UTC để lấy ngày local. Có thể bấm Hôm nay, Xóa và dùng bàn phím; popup tự giữ trong vùng màn hình.

## shadcn/ui

Đã cài toàn bộ component của registry shadcn Base UI/Vega bằng:

```sh
npx shadcn@latest add --all --yes
```

CLI yêu cầu xác nhận riêng cho file có sẵn, vì vậy lần đồng bộ ban đầu dùng thêm `--overwrite`, sau đó tùy chỉnh trực tiếp các file trong `components/ui`. Các component mới như calendar, chart, carousel, combobox, command, drawer, sidebar, OTP, resizable và code block đã có sẵn. Chúng được import trực tiếp theo nhu cầu; không có barrel import kéo toàn bộ vào mọi trang.

Khi bổ sung hoặc cập nhật shadcn, xem lại diff trước khi giữ thay đổi để bảo toàn API và cách trình bày đã tùy chỉnh. `Pagination` của dự án hỗ trợ link Next.js và trạng thái vô hiệu hóa; chat nổi dùng `DialogPopup` cùng primitive chung.

## Kiểm tra tính thống nhất

ESLint cấm `button`, `select`, `textarea`, input hiển thị và import trực tiếp Base UI ở ngoài `components/ui`; đồng thời chặn `Input` với type ngày/giờ native để dùng `DatePicker`. Input file native là ngoại lệ để tích hợp trình duyệt; nó chỉ phục vụ chọn tệp và được ẩn sau nút chung.

```sh
npm run lint
npm run typecheck
npm test
NEXT_PUBLIC_API_URL=https://your-api.example/api npm run build
```

Khi sửa primitive, kiểm tra các trang mua hàng, đăng nhập, hồ sơ, thông báo, người bán, quản trị và chat ở cả sáng/tối. Bảng hoặc thanh tab dài chỉ cuộn trong vùng riêng; toàn trang không được tràn ngang trên điện thoại.
