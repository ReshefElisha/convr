from flask import Flask, render_template, session, request
import os
from flask.ext.socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('connect', namespace='/chat')
def hello():
    currentSocketId = request.namespace.socket.sessid
    print 'New session: ' + currentSocketId

@socketio.on('hello', namespace='/chat')
def new_connection(message):
    #When a new connection is created broadcast its
        #USERNAME and ID to all clients
    print message['username'] + " connected to server"
    join_room(message['username']) #put user in their own room
    #This seems to be default behaviour in JS, but not in flask, odd...
    emit('welcome', {'username':message['username']})
    emit('new connection',
         {'username':message['username']},
         broadcast=True)


@socketio.on('disconnect', namespace='/chat')
def lost_connection():
    #When a connection is lost broadcast its
        #USERNAME to all clients
    if(len(list(request.namespace.rooms))>0):
        username = list(request.namespace.rooms)[0]
    else:
        username = ''
    print "Session " + username + " disconnected from server"
    emit('lost connection',
         {'username':username},
         broadcast=True)

@socketio.on('message', namespace='/chat')
def send_message(message):
    #When `sender` sends a message, send it to receiver ID
    print message
    emit('new message',
         {'text': message['text'],
          'sender': message['sender']},
         room=message['receiver'])

@socketio.on('hello new connection', namespace='/chat')
def hello_new_conenction(data):
    #When a new connection appears, all the existing connections say hi,
    #It's the polite thing to do. After all, they were raised right.
    emit('hi', {'username':data['from']},
         room=data['to']);

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port)
