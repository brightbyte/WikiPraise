// WikiTrust UserScript 0.10
// 2011 netAction Thomas Schmidt

// This UserScript est omnis divisa in partes duo.
// The first part is called WikiTrust and does some basic things.
// It loads data from the SURE server and modifies the DOM.
// The second part is called WikiPraise and does nothing else than visualisation.
// It could be replaced by users who need a different user interface.

// For more information visit http://de.wikipedia.org/wiki/Benutzer:NetAction/WikiTrust

// These three will be filled by WikiTrustLoad():
var WikiTrustRevisions, WikiTrustUsers;
var WikiTrustStatus=false; // contains "OK" or an error string when DOM is ready. Stays false when WikiTrust does not run on the current page. While waiting for SURE it is "loading".
var WikiPraiseVersion = "0.10";

// You can set this parameter in your common.js:
if (!window.WikiTrustSureUrl) window.WikiTrustSureUrl="https://wikitrust.netaction.de/sure";
// Alternative: https://toolserver.org/~netaction/sure

// #######################################################################
// #######################################################################
// #######################################################################
// WikiTrust runs before DOM is ready. It puts elements into the page
// content and fills the three global variables WikiTrustRevisions,
// WikiTrustUsers and WikiPraiseVersion.

(function( $ ) { // Wrapper around WikiTrust

  // ###### Check if we really run WikiPraise ######
  function WikiPraiseDoWeNeedIt() {
    if ( (mediaWiki.config.get("skin")=="vector") &&
      ($('#ca-nstab-main a').html()!="Main Page") &&
      ($('#ca-nstab-main').hasClass('selected')) && 
      ($('#mw-fr-revisioncontents').length==0) &&  // Preview in diffs
      ( ($('#ca-view').hasClass('selected')) ||
      ($('#ca-current').hasClass('selected'))) &&
      ($('#mw-diff-otitle1').length==0) // Preview in diffs
    ) return true;
    if ( (mediaWiki.config.get("skin")=="monobook") &&
      (!$('#ca-edit').hasClass('selected')) &&
      ($('#ca-nstab-main').hasClass('selected')) &&
      ($('#ca-nstab-main a').html()!="Main Page") &&
      ($('#ca-history').hasClass('selected')==false) &&
      ($('#ca-current').hasClass('selected'==false) ||
           ($('#mw-fr-revisioncontents').length==0)) &&
      ($('#mw-diff-otitle1').length==0) // Preview in diffs
    ) return true;

    // Wrong skin, edit page, discussion or something else:
    return false;
  }


  // ###### Let's start now ######
  if (WikiPraiseDoWeNeedIt()) {
    WikiTrustLoad(ManipulateOtherElements);
  } else {
    ManipulateOtherElements();
  }


  // Sometimes Wikimedia API returns different HTML than we see in Wikipedia.
  // This is not dependent on the user's language but on the Wikipedia version:
  var WikiTrustLangURLs = {
  'en': { edit:'edit',toc:'Contents'},
  'de': { edit:'bearbeiten',toc:'Inhaltsverzeichnis'},
  }
  function WTgetURL(msg) {
    // http://de.wikipedia.org/wiki/Wikipedia:JS
    var variant = mediaWiki.config.get('wgContentLanguage');
    if (!(variant in WikiTrustLangURLs)) variant = 'en'; // Should not happen
    if (!(msg in WikiTrustLangURLs[variant])) variant = 'en'; // Should not happen
    return WikiTrustLangURLs[variant][msg];
  }


  // ###### Fetch sequences from sure, build HTML and call callback ######
  function WikiTrustLoad(callback) {
    // try find this revision's ID in the URL:
    var currentID=RegExp('[?&]oldid=([^&#]*)').exec(window.location.search);
    // if there is no ID in the URL we take the latest version:
    if (currentID) currentID=currentID[1]; else currentID=wgCurRevisionId;

    WikiTrustStatus = "loading";
    // Get the WikiCode of this article:
    $.getJSON(window.WikiTrustSureUrl+'?'+
      'project='+mediaWiki.config.get('wgContentLanguage')+'&'+
      'revid='+encodeURIComponent(currentID)+'&callback=?',
      function(data) {
        if (data.error!=undefined) {
          WikiTrustStatus=data.error;
          ManipulateOtherElements();
          // if ($.cookie("wikitrust")=="active") WikiTrustAuthorlist(false,data.error);
          return;
        }
        // Get rid of stuff from other JavaScript because it is not in WikiTrust's HTML:
        $('#mw-fr-revisiontag').remove(); // "Nicht markiert"
        // Still buggy:
        // http://en.wikipedia.org/wiki/Main_Page
        $('.collapseButton').remove();
        // Warning! These elements depend both on the wikipedia language and the user language.
        if ($('.editsection').length<1) $('span.mw-headline').prepend('<span style="display:none;">['+WTgetURL('edit')+']</span>');
          else $('.editsection a').html(WTgetURL('edit'));
        $('#toctitle h2').html(WTgetURL('toc'));
        
        // html2 is the var with the resulting html after all modifications:
        var html2 = $('#bodyContent').html(); // 40ms
        // Take only the trailing part which will not be modified:
        if (mediaWiki.config.get("skin")=="vector") html2 = html2.substr(0,html2.indexOf('<!-- bodycontent -->'));
        else html2 = html2.substr(0,html2.indexOf('<!-- start content -->'));

        // if revisiontag exists put it into html2:
        if ($('#mw-fr-revisiontag-old').length>0) html2+=$('#mw-fr-revisiontag-old').clone().wrap('<div></div>').parent().html();
        $('#mw-fr-revisiontag-old').remove();
        
        // the variable "html" contains the unmodified content
        // that will be used in this method:
        var html = $('#bodyContent').html();
        if (mediaWiki.config.get("skin")=="vector") html=html.substr(html.indexOf('<!-- bodycontent -->')+21);
        else html=html.substr(html.indexOf('<!-- start content -->')+23);

        //html = html.replace('(<a href="#">'+WTgetURL('map')+'</a>)',"");
        html = html.replace(/&amp;/g,"＆");
        html = html.replace(/&nbsp;/g," ");
        html = html.replace(/&#160;/g," ");

        var edit = 0;
        var editpos = 0;
        var tag=false;
        var revid=false;
        for (i = 0; (i < html.length) && (edit<data.sequences.length); i++) {
          var charAti=html.charAt(i);
          var charCodeAti=html.charCodeAt(i);
          if (charAti=="<") {
            if(revid) html2+='</span>';
            revid=false;
            tag=true;
          } else if (charAti==">") tag=false;
          else if (!tag) {
            if ((revid)&&(revid!=data.sequences[edit][0])) {
              revid=data.sequences[edit][0]
              html2+='</span><span class="WT WT-'+revid+'">';
            } else if (!revid) {
              if (charCodeAti>32) { // do not tag single white spaces
                revid=data.sequences[edit][0]
                html2+='<span class="WT WT-'+revid+'">';
              }
            } else if (charCodeAti<=32) {
            //} else /*if (charCodeAti<=32)*/ {
            //  html2+='</span><span class="WT WT-'+revid+'" title="'+editpos+'">';
              html2+='</span><span class="WT WT-'+revid+'">';
            }
            if (charCodeAti>32) editpos++;
            if (editpos==data.sequences[edit][1]) {
              // add number of characters of this sequence to corresponding revision info:
              if (data.revisions[revid].charcount) data.revisions[revid].charcount+=editpos;
                else data.revisions[revid].charcount=editpos;
              // next sequence:
              editpos = 0;
              edit++;
            }
          }
          html2+=charAti;
        }

        html2 = html2.replace(/＆/g,"&amp;");
        html2+="</span>"+html.substr(i);
        html = "";

        WikiTrustRevisions = data.revisions;
        if (data.users.length!=0) WikiTrustUsers = data.users;
          else WikiTrustUsers = {};

        document.getElementById("bodyContent").innerHTML = '<div>'+html2+'</div>';
        html2 = "";

        WikiTrustStatus="OK";
        callback();
    });
  } // WikiTrustLoad



  // ###### Do this after we are ready here ######
  function ManipulateOtherElements() {
    $.holdReady(false);
  } // ManipulateOtherElements

})( jQuery ); // Wrapper around WikiTrust




// #######################################################################
// #######################################################################
// #######################################################################
// WikiPraise runs on DOM ready like all the other scripts.
// It needs the elements created by WikiTrust and the three global vars.


(function( $ ) { // Wrapper around WikiPraise
  // ###### some rough l10n and i18n ######
  var WikiTrustLangMsgs = {
  'en': {
    WrittenInRev: 'Written in rev.',
    WrittenOnRev: 'on',
    ClickToFix: 'Click to fix this box.',
    Author: 'Author',
    UserLink2:'talk',
    UserLink3:'contribs',
    TooltipTitle:'WikiTrust',
    WelcomeMessage:'You are using WikiTrust. Please click in the text to see the author.',
    ActivateLink:'show list of authors',
    ActiveLoading:'Loading...',
    ActiveTitle:'WikiTrust<br />List of Authors',
    ActiveTitleError:'WikiTrust<br />Error',
    CharacterNumber:'characters'
  },
  'de': {
    WrittenInRev: 'Geschrieben in Ver.',
    WrittenOnRev: 'am',
    ClickToFix: 'Klick zum Fixieren!',
    Author: 'Autor',
    UserLink2:'Diskussion',
    UserLink3:'Beiträge',
    TooltipTitle:'WikiTrust',
    WelcomeMessage:'Du verwendest Wikitrust. Klicke auf den Text um zu sehen, wer ihn geschrieben hat.',
    ActivateLink:'Autorenliste anzeigen',
    ActiveLoading:'Lade...',
    ActiveTitle:'WikiTrust<br />Autorenliste',
    ActiveTitleError:'WikiTrust<br />Fehler',
    CharacterNumber:'Buchstaben'
  },
  }
  function WTgetMsg(msg) {  // get the string in the user's language
    // This does not depend on the Wikipedia project
    // but only on the selected user interface language
    // http://de.wikipedia.org/wiki/Wikipedia:JS
    var lang = mediaWiki.config.get('wgUserLanguage');
      if (!(lang in WikiTrustLangMsgs)) lang = 'en'; // Language unknown?
      if (!(msg in WikiTrustLangMsgs[lang])) lang = 'en'; // String not existent?
      return WikiTrustLangMsgs[lang][msg];
  }

  // The url parts for every language version of Wikipedia
  var WikiTrustLangURLs = {
  'en': { UserLink1: '/wiki/User:',UserLink2: '/wiki/User_talk:',UserLink3: '/wiki/Special:Contributions/',edit:'edit',toc:'Contents'},
  'de': { UserLink1: '/wiki/Benutzer:',UserLink2: '/wiki/Benutzer_Diskussion:',UserLink3: '/wiki/Spezial:Beiträge/',edit:'bearbeiten',toc:'Inhaltsverzeichnis'},
  'fr': { UserLink1: '/wiki/Utilisateur:',UserLink2: '/wiki/Discussion_utilisateur:',UserLink3: '/wiki/Sp%C3%A9cial:Contributions/'}
  }
  function WTgetURL(msg) {
    // http://de.wikipedia.org/wiki/Wikipedia:JS
    var variant = mediaWiki.config.get('wgContentLanguage');
    if (!(variant in WikiTrustLangURLs)) variant = 'en'; // Should not happen
    if (!(msg in WikiTrustLangURLs[variant])) variant = 'en'; // Should not happen
    return WikiTrustLangURLs[variant][msg];
  }


  // ###### Put the CSS into page head ######
  function WikiPraiseAddStyling() {
    // We can not live without some styling:
    $("head").append('<style type="text/css" charset="utf-8">'+
      'span.WT.active { color:black; background-color:#CFDEE4; } '+
      'a span.WT.active { text-decoration:underline; } '+
      '.WTactiveUser { color:black; background-color:#E4CFDE; } '+
      'a .WTactiveUser { text-decoration:underline; } '+
      'div#WikiTrustTooltip { position:absolute; top:100px; left:5px; background-color:#eee; width:143px; padding:4px; z-index:100; border:1px solid #93B5C0; font-size:80%; box-shadow:3px 3px 8px #666; }'+
      '.skin-monobook div#WikiTrustTooltip { font-size:110%; }'+
      'div#WikiTrustTooltip.fixed { border:3px solid #648793; }'+
      'p#WikiTrustTooltipTitle { background-color:#93B5C0; margin:-4px -4px 0 -4px; text-align:center; color:white; }'+
      '.fixed p#WikiTrustTooltipTitle { background-color:#648793; color:white; }'+
      '.fixed div#WikiTrustCloseButton { position:absolute; right:0; top:0; cursor:pointer; color:white; z-index:110; }'+
      'div#WikiTrustActiveCloseButton { position:absolute; right:0px; top:-2em; cursor:pointer; padding:0px 6px; border-radius:12px; background-color:#BED3DA; border:4px solid #E0E9F0; color:#fafafa; }'+
      'div#WikiTrustActiveCloseButton:hover { background-color:#93B5C0; }'+
      '#WikiTrustInfotext { border: 1px solid #aaa; padding: 5px; line-height: 1.5em; margin: .5em 1em 0em 0em; text-align: center; clear: both; }'+
      '#WikiTrustLoading { position:absolute; left:50%; top:50%; width:100px; height:20px; margin-left:-50px; margin-top:-25px; background-color:#eee; box-shadow:3px 3px 8px #666; border:1px solid #93B5C0; z-index:200; padding:20px; text-align:center; }'+
      '#WikiTrustWelcomeMessage { border: 1px solid #aaa; padding: 5px; line-height: 1.5em; margin: .5em 1em 0em 0em; text-align: center; clear: both; background-color:#93B5C0; color:white; font-size:120% }'+
      '#WikiTrustActive { position:absolute; right:-12em; top:0; width:10em; background-color:#f7f7f7; padding:0 1em 1em 1em; outline: 1px solid #A7D7F9;  border-top:2em solid #E0E9F0; margin-top:10px;}'+
      'div#content.WikiTrustActive { margin-right:12em; position:relative; }'+
      '#WikiTrustUsersList li {cursor:pointer; font-size:80%;}'+
      '#WikiTrustAuthorlistButton {color:#0645AD; cursor:pointer;}'+
      '#WikiTrustAuthorlistButton:hover {text-decoration:underline;}'+
      '#WikiTrustActiveTitle { padding-left:1em; font-size:110%;}'+
      'div.references-column-width {-moz-column-width: auto!important; -webkit-column-width: auto!important; column-width: auto!important;}'+ // browsers are still too buggy for this.
      'p#WikiTrustVersion { padding-left:1em; color:#aaa; font-size:70%; }'+
      'p#WikiTrustVersion a { color:#aaa; }'+
      '</style>'
    );
  }



  // ###### Show the list of authors ######
  function WikiTrustAuthorlist(preload) {
    // renew cookie:
    $.cookie("wikitrust", "active", { expires: 300, path: '/' });

    if (preload) { //  only show loading information.
      $('<div id="WikiTrustActive"><p id="WikiTrustActiveTitle">'+WTgetMsg('ActiveLoading')+'</p></div>').prependTo('#content');
      $('#content').addClass('WikiTrustActive');
    } else { // we want the full author information
      if (WikiTrustStatus!="OK") { // Error occured
        $('#WikiTrustActive').html(
          '<p id="WikiTrustActiveTitle">'+WTgetMsg('ActiveTitleError')+'</p>'+
          '<p id="WikiTrustActiveErrormessage"></p>'
        );
        $('#WikiTrustActiveErrormessage').text(WikiTrustStatus);
        return;
      }

      if($('#WikiTrustActive').length==0) $('<div id="WikiTrustActive"></div>').prependTo('#content');
      $('#WikiTrustActive').html('<p id="WikiTrustActiveTitle">'+WTgetMsg('ActiveTitle')+'</p>');
      $('#content').addClass('WikiTrustActive');
      $.each(WikiTrustUsers, function(key,value){ // add array for revision ids and text length to each user
        WikiTrustUsers[key].revids=new Array();
        WikiTrustUsers[key].charcount=0;
      });
      WikiTrustUsers['<em>Bots</em>']={};
      WikiTrustUsers['<em>Bots</em>'].revids=new Array();
      WikiTrustUsers['<em>Bots</em>'].charcount=0;
      WikiTrustUsers['<em>Anonymous</em>']={};
      WikiTrustUsers['<em>Anonymous</em>'].revids=new Array();
      WikiTrustUsers['<em>Anonymous</em>'].charcount=0;
      $.each(WikiTrustRevisions, function(key,value){ // add revids to the arrays
        if (!value['a']  && value['charcount']) {
          WikiTrustUsers[value['u']].revids.push(key);
          WikiTrustUsers[value['u']].charcount += value['charcount'];
          if (WikiTrustUsers[value['u']].b) { // Bots are listed both as users and the special bot user:
            WikiTrustUsers['<em>Bots</em>'].revids.push(key);
            WikiTrustUsers['<em>Bots</em>'].charcount += value['charcount'];
          }
        }
        else if (value['charcount']) { // Anonymous is one user for all IPs:
          WikiTrustUsers['<em>Anonymous</em>'].revids.push(key);
          WikiTrustUsers['<em>Anonymous</em>'].charcount += value['charcount'];
        }
      });

      // Sort users by number of characters:
      WikiTrustUsersList = [];
      $.each(WikiTrustUsers,function(key,value) {
        WikiTrustUsersList.push(key);
      });
      WikiTrustUsersList.sort(function (a, b) {
        return WikiTrustUsers[a].charcount < WikiTrustUsers[b].charcount ? 1 : -1;
      });

      // add Users to list of users:
      $('#WikiTrustActive').append('<ul id="WikiTrustUsersList"></ul>');
      $.each(WikiTrustUsersList, function(index,value){ // add users to html

        if (!WikiTrustUsers[value].b) // not a bot
        if (WikiTrustUsers[value].revids.length>0)
          $("<li>"+value+"</li>").data('revids',WikiTrustUsers[value].revids).appendTo('#WikiTrustUsersList');
      });

      // Add tooltip with number of letters:
      $('#WikiTrustUsersList li').each(function() {
        $(this).attr('title',WikiTrustUsers[$(this).html()].charcount+' '+WTgetMsg('CharacterNumber'));
      });

      // Click on an author's name in the UsersList:
      $('#WikiTrustUsersList li').click(function() {
        $('#WikiTrustUsersList li').removeClass('WTactiveUser');
        $(this).addClass('WTactiveUser');
        $('span.WT.WTactiveUser').removeClass('WTactiveUser');
        $.each($(this).data('revids'),function(key,value){
          $('span.WT-'+value).addClass('WTactiveUser');
        });
      });
      // Click on close button:
      $('<div id="WikiTrustActiveCloseButton">⨯</div>').click(function() {
        $('span.WT.WTactiveUser').removeClass('WTactiveUser');
        $.cookie("wikitrust", "sleep", { expires: 300, path: '/' });
        $('#content').removeClass('WikiTrustActive');
        $('#WikiTrustActive').remove();
      }).appendTo('#WikiTrustActive');
      $('<p id="WikiTrustVersion"><a href="http://de.wikipedia.org/wiki/Benutzer:NetAction/WikiTrust">WikiTrust</a> '+WikiPraiseVersion+'</p>').appendTo('#WikiTrustActive');
    }
  } // WikiTrustAuthorlist




  // ###### Hover UI, info box, trigger for list of authors ######
  function WikiPraise() {
    function showTooltip(element) {
      var versionid=RegExp('WT-([^ ]*)').exec($(element).attr("class"));
      if (versionid) versionid=versionid[1]; else return;
      var username=WikiTrustRevisions[versionid]['u'];
      var revDate=new Date;
      revDate.setTime(WikiTrustRevisions[versionid]['ts']*1000);
      if (!username) return;
      $('span.WT-'+versionid).addClass('active');
      $('#WikiTrustTooltip').show().css({'top' : $(element).offset().top})
        .html('<p id="WikiTrustTooltipTitle">'+WTgetMsg('TooltipTitle')+'</p>'+
        '<p>'+WTgetMsg('Author')+': '+
        '<a href="'+WTgetURL('UserLink1')+username+'">'+username+'</a>'+
        '<br />'+
        '(<a href="'+WTgetURL('UserLink2')+username+'">'+WTgetMsg('UserLink2')+'</a> | '+
        '<a href="'+WTgetURL('UserLink3')+username+'">'+WTgetMsg('UserLink3')+'</a>)'+
        '<p/>'+
        '<p>'+
        WTgetMsg('WrittenInRev')+' '+
        '<a href="/w/index.php?'+
        'title='+encodeURIComponent(wgPageName)+'&'+
        'action=historysubmit&diff=prev&oldid='+versionid+'">'+
        versionid+'</a> '+
        WTgetMsg('WrittenOnRev')+' '+revDate.getDate()+'.'+(revDate.getMonth()+1)+'.'+revDate.getFullYear()+'</p>'+
        '<p>'+WikiTrustRevisions[versionid]['charcount']+' '+WTgetMsg('CharacterNumber')+'</p>'+
        '<p class="infotext">'+
        WTgetMsg('ClickToFix')+
        '</p>'+
        '<p id="WikiTrustAuthorlistButton">'+
        WTgetMsg('ActivateLink')+
        '</p>');
      $('#WikiTrustAuthorlistButton').click(function() {
        WikiTrustAuthorlist(false);
      });
      if ($.cookie("wikitrust")=="active") $('#WikiTrustAuthorlistButton').remove();
    }  // showTooltip

    function hideTooltip(element) {
      var versionid=RegExp('WT-([^ ]*)').exec($(element).attr("class"));
      if (versionid) versionid=versionid[1]; else return;
      $('span.WT-'+versionid).removeClass('active');
      $('#WikiTrustTooltip').hide();
    }

    function unFixTooltip(element) {
      $('#WikiTrustTooltip').removeClass('fixed').fadeOut();
      $('span.WT.active').removeClass('active');
    }
    
    function fixTooltip(element) {
      $('#WikiTrustTooltip .infotext').hide();
      $('#WikiTrustTooltip').addClass('fixed').append('<div id="WikiTrustCloseButton">⨯</div>');
    }

    // Put the tooltip into DOM:
    $('<div id="WikiTrustTooltip" style="display:none;"></div>').prependTo('body');
    // hide() is slow.

    if (!$.cookie("wikitrust")) {
      $('<div id="WikiTrustWelcomeMessage">'+WTgetMsg('WelcomeMessage')+'</div>').prependTo('#bodyContent');
      $.cookie("wikitrust", "sleep", { expires: 300, path: '/' });
    } else if ($.cookie("wikitrust")=="sleep") $.cookie("wikitrust", "sleep", { expires: 300, path: '/' });
    else if ($.cookie("wikitrust")=="active") WikiTrustAuthorlist(false);

    // ### breathe life into content with all the triggers:
    // If the user hovers content, show box with author's name:
    $('#bodyContent').delegate('span.WT',"mouseover mouseout click",function(event) {
    // (replace .delegate() with .on() as soon as MediaWiki updates to jQuery 1.7)
    if (event.type == "mouseover") {
      if ($('#WikiTrustTooltip').hasClass('fixed')) return;
      if ($.cookie("wikitrust")=="sleep") return;
      showTooltip(this);
    } else if (event.type == "mouseout") { // If the user leaves content, hide box:
      if ($('#WikiTrustTooltip').hasClass('fixed')) return;
      if ($.cookie("wikitrust")=="sleep") return;
      hideTooltip(this);
    } else { // On click
      if (($.cookie("wikitrust")=="sleep") && (!$('#WikiTrustTooltip').hasClass('fixed'))) {
        if ((!$(this).parent().is('a')) && (!$(this).parent().parent().is('a'))) {
          showTooltip(this);
          fixTooltip(this);
        }
      } else if ($('#WikiTrustTooltip').hasClass('fixed')) {
        unFixTooltip(this);
      } else {
        showTooltip(this);
        fixTooltip(this); // keep the box where it is
      }
      //return false;
    }});
    // unfix box if user clicks in box (X):
    $('#WikiTrustTooltip').click(function() {
      unFixTooltip();
    });
  } // WikiPraise


  // ###### R U N ######
  WikiPraiseAddStyling();
  if ((WikiTrustStatus=="loading") && ($.cookie("wikitrust")=="active"))
    WikiTrustAuthorlist(true); // show loading message

  $(function() { // DOM ready
    if (WikiTrustStatus=="OK") WikiPraise(); // Everything was fine. Prepare WikiPraise:
    else if (WikiTrustStatus) WikiTrustAuthorlist(false); // show error message
  });

})( jQuery ); // Wrapper around WikiPraise
