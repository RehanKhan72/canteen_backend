let ioInstance = null;
export function initSocket(io) {
    ioInstance = io;
    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);
        socket.on("joinKitchen", () => {
            socket.join("kitchen-room");
        });
        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });
}
export function emitKitchenUpdate(data) {
    if (!ioInstance)
        return;
    ioInstance.to("kitchen-room").emit("kitchen_update", data);
}
