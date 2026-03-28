package ws

var GlobalHub *Hub

func Init() {
	GlobalHub = NewHub()
	go GlobalHub.Run()
}
