/** @jsx React.DOM */
$(document).ready(function(){
  namespace = '/chat';
  var myUsername = ""; //Keep in Cookie
  var connections = [];
  var conversations = []; //Keep in Cookie
  var openConversations = [];
  var socket = io.connect('http://' + document.domain + ':' + location.port + namespace); //connect to socket
  var colors=['#F44336','#E91E63','#9C27B0','#673AB7','#3F51B5','#2196F3','#009688','#FF5722','#795548','#607D8B'] //material design colors
  
  if(document.cookie){ //reloading state from cookie
    oldState = JSON.parse(document.cookie);
    myUsername = oldState.username;
    conversations = oldState.convers;
  }
  
  if(myUsername ==""){ //sometimes cookie stores empty data, we can refill it here
    var loginBox = React.createClass({
      render: function() {
        return (
              <div id="loginBox">
                <img src={"static/logo.png"} alt="convR logo"/>
                <form id="connect" method="POST" action="#">
                  <input type="text" name="username" id="username"/>
                  <input className="button" type="submit" value="Go"/>
                </form>
              </div>
        )
      }
    });
    
    React.render(React.createElement(loginBox, null), document.getElementById('content'));
  }
  else{ //if there is correct data in the cookie, the button won't be pressed, so we need to call the emit ourselves
    socket.emit('hello', {username: myUsername});
  }
  
  $('#connect').submit(function(event) { //when the butotn gets pressed we say hello to the server
    event.preventDefault();
    myUsername = ($('#username').val());
    socket.emit('hello', {username: $('#username').val()});
    return false;
  });
  
  var ConvoStarter = React.createClass({ //This is the dropdown
    render: function() {
      return (
        <select id="convoStarter">
        </select>
      );
    }
  });
  
  var ChatsWindow = React.createClass({ // This is the main app window
    render: function() {
      return (
        <div id="convr">
          <div className="header">
            <p>Username: {this.props.username} </p>
            <form id="selectConversation">
              <label>Start a conversation with: </label>
                <ConvoStarter />
              <input type="button" value="Talk!" onClick={startChat}/>
            </form>
          </div>
          <div id="chats">

          </div>
        </div>
      );
    }
  });
  
  function startChat(){ //function that gets called when a user presses the `Talk!` button
    var convoStarter = document.getElementById('convoStarter')
    openConversation(convoStarter.options[convoStarter.selectedIndex].text);
  }
  
  /********************************************************************************************************************
  ***********************************************SOCKET FUNCTIONS******************************************************
  ********************************************************************************************************************/
  socket.on('welcome', function(data) { //server welcomes us the the main room
    if($('#loginBox')){ //we can now remove the login options
      $('#loginBox').remove();
    }
    React.render(<ChatsWindow username={myUsername} />, document.getElementById('content')); //render the main app
  });
  
  socket.on('new connection', function(data) { //when a new user enters the room
    newUsername = data.username;
    if(myUsername == newUsername){return false;} //for some reason client registers itself as a new user
    addConnectionToList(newUsername);
    socket.emit('hello new connection', {from: myUsername, to:newUsername}); //say hello to new user, so he knows this client is here
  });
  socket.on('hi', function(data) { //if we're the new users, and someone that was already in the room said hi to us
    newUsername = data.username; //we register them
    if(myUsername == newUsername){return false;} //did we just say hi to ourselves?
    addConnectionToList(newUsername); //add present client to list
  });
  
  socket.on('lost connection', function(data) { //someone leaves the room
    removeConnectionFromList(data.username);
    closeWindow(data.username..replace(/\s+/g, "-"));//call helper function
  });
  
  socket.on('new message', function(data) { //we got a message
    senderU = data['sender']; //sender's username
    messageText = data['text']; //message text
    var convoIndex = conversations.map(function(c) {return c.sender}).indexOf(senderU); //find if we have a conversation with the sender already
    
    if(convoIndex == -1){ //if we don't
      conversations.push({sender : senderU, messages : []}); //create a new one
      convoIndex = conversations.length - 1;
    }
    
    openConversation(senderU); //open a new conversation window (UI)
    conversations[convoIndex].messages.push({received: true, text: messageText}); //refresh it to see if there's old messages
    addMessageToConversation(conversations[convoIndex]); //and add the received message
  });
  
  socket.on('connect', function(data){
    console.log('connected!');
    if(myUsername != ""){
      socket.emit('hello', {username: myUsername});
    }
    $('head').append('<style> .messages{color:#000;}</style>');
  });
  
  socket.on('disconnect', function(data){
    $('head').append('<style> .messages{color:#bbb;}</style>');
  });
  
  /********************************************************************************************************************
  ********************************************LOGIC HELPER FUNCTIONS***************************************************
  ********************************************************************************************************************/
  
  function addConnectionToList(usernameToAdd) { //helper function to keep track of connections (present clients)
    var connIndex = connections.indexOf(usernameToAdd); //check if user is already present
    if(connIndex != -1){ //if they are
      return false; //they reregistered, which we ignore.
    }
    connections[connections.length] = usernameToAdd; //otherwise add them as a new connection
    connections.sort() //sort alphabetically, for aesthetics.
    updateConnectionsList(); //repopulate the dropdown
  }
  
  function removeConnectionFromList(usernameToRemove){ //helper function to remove connections
    var connIndex = connections.indexOf(usernameToRemove); //check the the username was actually present
    if(connIndex != -1){ //if it was
      connections.splice(connIndex, 1); //remove it
    }
    updateConnectionsList(); //repopulate the dropdown
  }

  sendMessage = function(to, message){ //helper function sending a message
    socket.emit('message',{receiver: to, sender: myUsername, text:message}); //emit it to the server, that will redirect to the recipient
    var convoIndex = conversations.map(function(c) {return c.sender}).indexOf(to); //get the proper conversation from the array
    conversations[convoIndex].messages.push({received: false, text: message});    //and add the message to the conversation
    addMessageToConversation(conversations[convoIndex]);                         //then call the UI helper function
  }
  
  /********************************************************************************************************************
  ***********************************************UI HELPER FUNCTIONS***************************************************
  ********************************************************************************************************************/
  
  function updateConnectionsList(){ //Repopulating connections dropdown menu
    emptyName = $.inArray("", connections); //fix for a bug where the dropdown would show an empty box under a VERY specific case
    if(emptyName>=0){connections.splice(emptyName,1);} //just remvoe that, we don't really care
    $('#convoStarter').empty(); //empty the whole thing
    connections.forEach(function(connection){ //refill it with the updated connections
      $('#convoStarter').append('<option value="' + connection +'">'+connection+'</option>');
    });
  }
  
  function openConversation(username){ //open a new chat window in the UI
    var convoIndex = conversations.map(function(c) {return c.sender}).indexOf(username); //get the index in the conversations list
    
    if(convoIndex == -1){ //if the index is -1, there is no conversation with given user
      conversations.push({sender : username, messages : []}); //create one with no messages
      convoIndex = conversations.length - 1; //set the index to end of list
    }
    if($.inArray(convoIndex, openConversations)>=0){return false;} //if a UI window is already open, skip the following steps
    openConversations.push(convoIndex); //mark conversation as having UI window open
    con = conversations[convoIndex]; //get the right conversation
    Math.seedrandom(con.sender); //generate a new seed with the username
    var color = colors[Math.floor(Math.random()*10)]; //get a random color for the window (it's ugly when they're all the same)
    $('#chats').append('<div class="chatbox" id="' + con.sender.replace(/\s+/g, "-") + '">'+ //this step could have been done with ract.js
                          '<div class="username" style="background-color:' + color +'">' +  //but the default behavior of jquery fit nicer
                            '<div class="text">'+con.sender+'</div>'+                      //in this specific instance, so I used that.
                            '<input type="button" class="iconX" onclick="closeWindow(\''+con.sender.replace(/\s+/g, "-")+'\')" value="X"/>'+
                          '</div>'+                                                     //^^^notice above that I don't want spaces in element IDs
                          '<div class="messages">'+                                    //so I replace them with dashes, that work better with the jquery selectors
                          '</div>'+
                          '<input type="text" class="messenger toSend" onkeydown="if (event.keyCode == 13){ sendMessage(\''+con.sender+'\',this.value); this.value=\'\'}">'+
                        '</div>');                                                //this just catches the `Enter` key event, and calls the sendMessage() function
    refreshConversation(con);
    $('#'+con.sender.replace(/\s+/g, "-")+'.messenger').focus();
  }
  
  closeWindow = function(windowToClose){ //function that is called when the `X` button is pressed
    $('#'+windowToClose).remove(); //jquery remove from DOM
    oCIndex = conversations.indexOf(windowToClose); //`windowToClose` is actually the username and ID of the UI window element
    openConversations.splice(openConversations.indexOf(oCIndex),1); //finally remove the conversation ID from the list of open windows
  }
  
  function addMessageToConversation(conversation){ //Adds a message at the bottom of the conversation then scrolls the window to the bottom
    message = conversation.messages[conversation.messages.length - 1] //get message at end of list
    $('#'+conversation.sender.replace(/\s+/g, "-")+' .messages').append('<p class="'+(message.received?'received':'sent')+' message">'+message.text+'</p>');
    $('#'+conversation.sender.replace(/\s+/g, "-")+' .messages').scrollTop($('#'+conversation.sender.replace(/\s+/g, "-")+' .messages')[0].scrollHeight);
  }
  
  function refreshConversation(conversation){ //redraws all the messages in a conversation
    conversation.messages.forEach(function(message){
      $('#'+conversation.sender.replace(/\s+/g, "-")+' .messages').append('<p class="'+(message.received?'received':'sent')+' message">'+message.text+'</p>');
    }); //then scrolls to the bottom
    $('#'+conversation.sender.replace(/\s+/g, "-")+' .messages').scrollTop($('#'+conversation.sender.replace(/\s+/g, "-")+' .messages')[0].scrollHeight);
  }
  
  /********************************************************************************************************************
  ******************************************************COOKIE*********************************************************
  ********************************************************************************************************************/
  
  $(window).bind('beforeunload', function(){ //finally, before the window is closed the state is saved in a cookie
    var state = {username: myUsername, convers: conversations}; //we only care about the registered username and the conversation texts
    var stringState = JSON.stringify(state);
    var date = new Date();
    date.setTime(date.getTime() + (1000*60*60*24*365*10)); //keep the cookie for 10 years, because we like doing things to excess.
    var expires = "expires="+date.toUTCString();
    document.cookie = stringState + "; " + expires; //create the final cookie
  });
});