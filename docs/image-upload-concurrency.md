# Tải nhiều ảnh

`src/lib/image-upload.ts` dùng hai hàng đợi riêng trên mỗi trang trình duyệt: tối đa hai ảnh đang giải mã/nén và bốn yêu cầu PUT lên kho ảnh. Giới hạn được dùng chung giữa các form để không giải mã đồng thời hàng chục ảnh camera lớn. Mỗi ảnh vẫn được mã hóa lại xuống tối đa 20 KiB, với WebP và phương án JPEG/PNG cho iOS.

Các ảnh trong một lần gửi được nén trước rồi xin phiên tải trong một yêu cầu, theo đúng thứ tự ban đầu. PUT chạy đồng thời và cập nhật tiến độ từng ảnh. Hoàn tất không theo thứ tự không làm thay đổi ảnh chính, thư viện ảnh hay tệp đính kèm. Khi gặp lỗi tạm thời, PUT thử lại trên cùng phiên và cùng dữ liệu tối đa hai lần. Nếu một ảnh lỗi hẳn, các tác vụ chưa bắt đầu dừng lại và hệ thống đợi mọi PUT đang chạy kết thúc trước khi hủy toàn bộ phiên, tránh dữ liệu được ghi lại sau khi đã dọn dẹp.

Chat xin một lô tối đa 50 phiên qua WSS `/chat-uploads/images`, tải ảnh đồng thời rồi gửi các tin nhắn theo thứ tự đã chọn. Mỗi tin giữ `client_message_id` và URL ảnh đã tải để thử lại sau lỗi phản hồi hoặc gửi thành công một phần mà không tải lại hay tạo bản sao.

Kiểm tra: `node tests/image-upload.test.mjs`, `node tests/backend-image-validation.test.mjs`, `node tests/chat-send-attempt.test.mjs` và `node tests/chat-image-send.test.mjs`.
