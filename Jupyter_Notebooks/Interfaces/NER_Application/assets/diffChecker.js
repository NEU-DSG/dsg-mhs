// https://stackoverflow.com/questions/38037163/how-to-highlight-the-difference-of-two-texts-with-css

highlight($("#new"), $("#old"));

function highlight(newElem, oldElem){
  var oldText = oldElem.text(),
      text = '';

  newElem.text().split('').forEach(function(val, i){
    if (val != oldText.charAt(i))
      text += "<span class='highlight'>" + val + "</span>";
    else
      text += val;
  });
  newElem.html(text);
}
