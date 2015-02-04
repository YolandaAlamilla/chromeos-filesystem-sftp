(function() {

  // Constructor

  var SftpClient = function(serverName, serverPort, authType, username, password, privateKey) {
    this.serverName_ = serverName;
    this.serverPort_ = serverPort;
    this.authType_ = authType;
    this.username_ = username;
    this.password_ = password;
    this.privateKey_ = privateKey;

    this.naclListener_ = null;
    this.naclEmbed_ = null;

    this.naclEventListenerMap_ = {};
  };

  // Public functions

  SftpClient.prototype.setup = function() {
    var elements = loadNaClModule.call(this);
    this.naclListener_ = elements.listener;
    this.naclEmbed_ = elements.embed;
    this.naclListener_.addEventListener("message", function(e) {
      var event = JSON.parse(e.data);
      console.log(event);
      var requestId = event.request;
      var listener = this.naclEventListenerMap_[requestId];
      if (listener) {
        listener(event);
      }
    }.bind(this), true);
  };

  SftpClient.prototype.connect = function(options) {
    addNaClEventListener.call(this, options.requestId, function(event) {
      if (checkEventMessage.call(this, event, "fingerprint", options.onError)) {
        options.onSuccess({
          requestId: event.request,
          fingerprint: event.values[0],
          algorithm: event.values[1]
        });
      }
    }.bind(this));
    postMessageToNaClModule.call(this, "connect", options.requestId, [this.serverName_, this.serverPort_]);
  };

  SftpClient.prototype.authenticate = function(options) {
    addNaClEventListener.call(this, options.requestId, function(event) {
      if (checkEventMessage.call(this, event, "authenticated", options.onError)) {
        options.onSuccess({
          requestId: event.request
        });
      }
    }.bind(this));
    postMessageToNaClModule.call(this, "authenticate", options.requestId, [
      this.authType_, this.username_, this.password_, this.privateKey_
    ]);
  };

  SftpClient.prototype.close = function(options) {
    addNaClEventListener.call(this, options.requestId, function(event) {
      if (checkEventMessage.call(this, event, "shutdown", options.onError)) {
        options.onSuccess();
      }
    }.bind(this));
    postMessageToNaClModule.call(this, "close", options.requestId, []);
  };

  SftpClient.prototype.getMetadata = function(options) {
    addNaClEventListener.call(this, options.requestId, function(event) {
      if (checkEventMessage.call(this, event, "metadataList", options.onError)) {
        var data = event.values[0];
        var metadata = {
          isDirectory: data.isDirectory,
          name: getNameFromPath.call(this, data.name),
          size: data.size,
          modificationTime: new Date(data.modificationTime * 1000)
        };
        options.onSuccess({
          metadata: metadata
        });
      }
    }.bind(this));
    postMessageToNaClModule.call(this, "file", options.requestId, [options.path]);
  };

  SftpClient.prototype.readDirectory = function(options) {
    addNaClEventListener.call(this, options.requestId, function(event) {
      if (checkEventMessage.call(this, event, "metadataList", options.onError)) {
        var metadataList = [];
        for (var i = 0; i < event.values.length; i++) {
          var data = event.values[i];
          var metadata = {
            isDirectory: data.isDirectory,
            name: getNameFromPath.call(this, data.name),
            size: data.size,
            modificationTime: new Date(data.modificationTime * 1000)
          };
          metadataList.push(metadata);
        }
        options.onSuccess({
          metadataList: metadataList
        });
      }
    }.bind(this));
    postMessageToNaClModule.call(this, "dir", options.requestId, [options.path]);
  };

  // Private functions

  var loadNaClModule = function() {
    var listener = document.createElement("div");
    var embed = document.createElement("embed");
    embed.width = 0;
    embed.height = 0;
    embed.src = "newlib/Release/sftp.nmf";
    embed.type = "application/x-nacl";
    listener.appendChild(embed);
    document.body.appendChild(listener);
    return {
      listener: listener,
      embed: embed
    };
  };

  var addNaClEventListener = function(requestId, listener) {
    this.naclEventListenerMap_[requestId] = listener;
  };

  var postMessageToNaClModule = function(command, requestId, args) {
    this.naclEmbed_.postMessage(JSON.stringify({
      command: command,
      request: requestId,
      args: args
    }));
  };

  var checkEventMessage = function(event, message, onError) {
    if (event.message === message) {
      return true;
    } else {
      onError("Unexpected message received(expect:" + message + " actual:" + event.message + ")");
      return false;
    }
  };

  var getNameFromPath = function(path) {
    var names = path.split("/");
    var name = names[names.length - 1];
    return name;
  };

  // Export

  window.SftpClient = SftpClient;

})();