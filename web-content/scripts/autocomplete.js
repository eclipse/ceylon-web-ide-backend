// Loosely adapted from CodeMirror.simpleHint
(function() {
  CodeMirror.autocomplete = function(editor, getHints) {
    // We want a single cursor position.
    if (editor.somethingSelected()) return;
    
    var filter = "";

    //don't show completion if the token is empty
    var cursor = editor.getCursor();
    var replaceFrom = cursor;
    
    var tempToken = editor.getTokenAt(cursor);
    if(!(/[\S]/gi.test(tempToken.string))) return;
    if(tempToken.type == "variable"
        || tempToken.type == "variable-2"
    	|| tempToken.type == "variable-3"
    	|| tempToken.type == "builtin"){
    	// we start with a filter
    	filter = tempToken.string.substring(0, cursor.ch - tempToken.start);
    	// we will replace that token entirely
    	replaceFrom = {line: cursor.line, ch: cursor.ch - filter.length};
    }else if(tempToken.type == null
    		&& tempToken.string == "."){
    	// no filter: member completion
    }else{
    	// let's not waste bandwidth here
    	return;
    }

    var result = getHints(editor);
    if (!result || !result.list.length) return;
    var completions = result.list;
    function insert(completion) {
    	// we replace from the replaceFrom point until whatever we already inserted
    	var replaceTo = {line: cursor.line, ch: replaceFrom.ch + filter.length};
    	editor.replaceRange(completion.insert, replaceFrom, replaceTo);
    	var bits = completion.insert.split(/[\(\)<>,]/g);
    	if (bits.length==1) {
    	   editor.setCursor({line: cursor.line, ch: replaceFrom.ch + completion.insert.length});
    	}
    	else {
    	   editor.setSelection({line: cursor.line, ch: replaceFrom.ch + bits[0].length+1},
    	                       {line: cursor.line, ch: replaceFrom.ch + bits[0].length+1 + bits[1].length});
    	}
    }
    // When there is only one completion, use it directly.
    if (completions.length == 1) {insert(completions[0]); return true;}

    // Build the select widget
    var complete = document.createElement("div");
    complete.className = "popupWithHelp infront";
    
    var input = document.createElement("input");
    complete.appendChild(input);
    
    var sel = complete.appendChild(document.createElement("div"));
    sel.className = "popup cm-s-ceylon";

    for (var i = 0; i < completions.length; ++i) {
      var opt = sel.appendChild(document.createElement("div"));
      if(i == 0)
    	  opt.className = "selected";
      opt.innerHTML = completions[i].display;
    }
    var pos = editor.cursorCoords();
    complete.style.left = pos.left + "px";
    complete.style.top = pos.bottom + "px";
    document.body.appendChild(complete);

    // now place the help window
    var help = complete.appendChild(document.createElement("div"));
    help.className = "help";
	help.innerHTML = completions[0].help;

    // If we're at the edge of the screen, then we want the menu to appear on the left of the cursor.
    var winW = window.innerWidth || Math.max(document.body.offsetWidth, document.documentElement.offsetWidth);
    if( (winW-pos.x) < sel.clientWidth && pos.x > sel.clientWidth){
    	help.style.left = "0px";
    	sel.style.left = help.clientWidth + "px";
    	complete.style.left = (pos.x-complete.clientWidth) + "px";
    }
    else if ((winW-pos.x) < (complete.clientWidth) && pos.x > help.clientWidth) {
        help.style.left = "0px";
        sel.style.left = help.clientWidth + "px";
        complete.style.left = (pos.x-help.clientWidth) + "px";
    }

    var selectedIndex = 0;
    var insertionPoint = cursor.ch;
    var originalInsertionPoint = insertionPoint;
    var done = false;
    
    var hump = /^[a-z0-9]+|[A-Z][a-z0-9]*/g;
    
    function completionMatches(index){
      if (originalInsertionPoint==insertionPoint) return true;
      var completion = completions[index].insert;
      if (completion.toLowerCase().indexOf(filter.toLowerCase())==0) return true;
      var filterHumps = filter.match(hump);
      var completionHumps = completion.match(hump);
      if (completionHumps.length<filterHumps.length) return false;
      for (i=0; i<filterHumps.length; i++) {
          if (completionHumps[i].toLowerCase().indexOf(filterHumps[i].toLowerCase())!=0) return false;
      }
      return true;
    }
    function updateFilter(){
    	var $children = jQuery(sel).children();
        var oldsi=selectedIndex;
    	selectedIndex = -1;
    	$children.each(function (index, line){
    		var $line = jQuery(line);
    		if(completionMatches(index)){
    			if(selectedIndex == -1) {
    				selectedIndex = index;
				}
    			$line.show();
    		} else {
    			$line.hide();
			}
    		$line.removeClass("selected");
    	});
    	if(selectedIndex != -1) {
    		$children.eq(selectedIndex).addClass("selected");
            if (selectedIndex!=oldsi)selectionChanged();
        }
    }
    function selectionChanged(){
    	// update the selected class
    	var $children = jQuery(sel).children();
    	$children.removeClass("selected");
    	var $selected = $children.eq(selectedIndex);
    	$selected.addClass("selected");
    	
    	// autoscroll
    	var offset = $selected.get(0).offsetTop;
    	var scrollTop = sel.scrollTop;
    	var offsetInSel = offset - scrollTop;
    	if(offsetInSel > 150){
    		sel.scrollTop = offset - 100;
    	}else if(offsetInSel < 50 && scrollTop != 0){
    		sel.scrollTop = Math.max(0, offset - 100);
    	}
    	
    	// update the help
    	help.innerHTML = completions[selectedIndex].help;
    }
    var prettyPleaseStop=false;
    var updating=false;
    function keydown(event){
        prettyPleaseStop=false;
    	function prevent(){
            event.preventDefault();
            event.stopPropagation();
            prettyPleaseStop=true;
    	}
    	
    	var code = event.which;
    	// Escape, Left, Right
    	if(code == 27 || code == 37 || code == 39){
    		prevent();
    		close();
    		editor.focus();
    	}else if(code == 13){
    		prevent();
    		// Enter
    		pick();
    	}else if(code == 40){
          prevent();
          // Down
          var elems = jQuery(sel).children();
          var lastVisible=-1;
          var whatev=completions.length-1;
          while (lastVisible<0) {
            if (elems.eq(whatev).is(':visible'))lastVisible=whatev;
            whatev--;
          }
    		while(selectedIndex < lastVisible) {
    		    selectedIndex++;
    			if(completionMatches(selectedIndex))
    				break;
    		}
    		selectionChanged();
    	}else if(code == 38){
          prevent();
          // Up
          var elems = jQuery(sel).children();
          var firstVisible=-1;
          var whatev=0;
          while (firstVisible<0) {
            if (elems.eq(whatev).is(':visible'))firstVisible=whatev;
            whatev++;
          }
    		while(selectedIndex > firstVisible) {
    		    selectedIndex--;
    			if(completionMatches(selectedIndex))
    				break;
    		}
    		selectionChanged();
    	}else if(code == 36){
    		prevent();
    		// Home
    		selectedIndex = 0;
    		selectionChanged();
    	}else if(code == 35){
    		prevent();
    		// End
    		selectedIndex = completions.length - 1;
    		selectionChanged();
    	}else if(code == 8){
    		prevent();
    		// Backspace
    		editor.triggerOnKeyDown(event);
    		insertionPoint--;
    		if(insertionPoint < cursor.ch){
    			close();
    			editor.focus();
    		}else{
    			// normally we must have a filter here
    			if(filter.length > 0){
    				filter = filter.substring(0, filter.length-1);
    				updateFilter();
    			}
    		}
    	}
    }
    function close() {
      if (done||updating) {
        return;
      }
      done = true;
      jQuery(input).unbind('keydown', keydown);
      jQuery("body").unbind('click', bodyClick);
      complete.parentNode.removeChild(complete);
      live_tc.status=1;
    }
    closePopups=close;
    function pick() {
      insert(completions[selectedIndex]);
      close();
      setTimeout(function(){editor.focus();}, 50);
    }
    // listen to choice clicks
    jQuery(sel).children().click(function (event){
    	// we might click on a child element of the line, so find the right ancestor
    	var $line = jQuery(event.target).closest(".popup > div");
    	selectedIndex = $line.index();
    	input.focus();
    	selectionChanged();
    });
    // prevent blur such as happens when clicking on the completion list scroll bar
    jQuery(input).blur(function(event){
    	event.preventDefault();
    	event.stopPropagation();
    	input.focus();
    	return false;
    });
    // now do a hack to close the dialog on clicks that happen outside the completion
    // window
    function bodyClick(event){
    	if(jQuery(event.target).closest(".popupWithHelp").size() == 0){
    		close();
    	}
    }
    jQuery("body").click(bodyClick);
    // capture keys
    jQuery(input).keydown(keydown);
    jQuery(input).keypress(function(event){
        if (prettyPleaseStop) {
          return;
        }
    	var char = String.fromCharCode(event.which);
    	updating = true;
		editor.replaceRange(char, {line: cursor.line, ch: insertionPoint++});
		updating = false;
		filter += char;
		updateFilter();
    });
    // do we have an initial filter?
    //if(filter.length > 0)
    //	updateFilter();

    input.focus();
    // Opera sometimes ignores focusing a freshly created node
    if (window.opera) setTimeout(function(){if (!done) input.focus();}, 100);
    return true;
  };
})();
