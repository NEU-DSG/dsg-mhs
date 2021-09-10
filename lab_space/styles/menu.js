// Template from Cara Marta Messina
// https://github.com/caramessina/caramessina.github.io

// Get <header> by id "menu".
const header = document.getElementById('menu');

// Create <link> element.
const link = document.createElement('link');
link.setAttribute('rel', 'stylesheet');
link.setAttribute('href', '/styles/menu-dark.css');
// link.setAttribute('href', '/styles/menu.css');

// Create <ul> element.
const ul = document.createElement('ul');
ul.setAttribute('class', 'topnav');

// Create HOME link.
const l1 = document.createElement('li');
const homeA = document.createElement('a');
homeA.setAttribute('href', '/index.html');
homeA.setAttribute('class', 'logo');

const homeText = document.createTextNode('Primary Source Coop');
homeA.appendChild(homeText)
l1.appendChild(homeA);
ul.append(l1);

// Create ABOUT link.
const l2 = document.createElement('li');
const aboutA = document.createElement('a');
aboutA.setAttribute('href', '/about/index.html');

const aboutText = document.createTextNode('About');
aboutA.appendChild(aboutText);
l2.append(aboutA);
ul.append(l2);

// Create first dropdown menu.
const project = document.createElement('li');
project.setAttribute('class', 'dropdown');

const projectA = document.createElement('a');
projectA.setAttribute('href', '/projects/index.html');
projectA.setAttribute('class', 'dropbtn');

const projectAText = document.createTextNode('Projects');
projectA.append(projectAText);
project.append(projectA);

const projectDiv = document.createElement('div');
projectDiv.setAttribute('class', 'dropdown-content');

// Create <li>'s in first dropdown menu.
// jqa
const jqaA = document.createElement('a');
jqaA.setAttribute('href', '/projects/jqa/index.html');
const jqaText = document.createTextNode('JQA');
jqaA.append(jqaText);
projectDiv.append(jqaA);

// Append <a> to project <div>
project.append(projectDiv); // Append <div> to project
ul.append(project);

// Append <link> & <ul> to <header>.
header.append(link);
header.appendChild(ul);
