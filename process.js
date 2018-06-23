/**
 * Process requested actions to generate PDFs of template and upload to chat app
 */
const debug = process.env.DEBUG === 'true';
const uploader = require('./integrations/' + process.env.INTEGRATION + '/uploader');
const queryString = require('query-string');
const fs = require('fs');
const unzip = require('unzip');
const emailVcs = require('email-vcs');
const wkhtmltopdf = require('wkhtmltopdf');
const octokit = require('@octokit/rest')({
  debug: debug
});

//set path for lambda
if (process.env['LAMBDA_TASK_ROOT']) {
  process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];
}

//set path for travis
if (process.env['TRAVIS_BUILD_DIR']) {
  process.env['PATH'] = process.env['PATH'] + ':' + process.env['TRAVIS_BUILD_DIR'];
}

//authenticate to github
octokit.authenticate({
  type: 'oauth',
  token: process.env.GITHUB_API_TOKEN
});

module.exports = (function(){

  const bot = {

    octokit: octokit,

    uploader: uploader,

    /**
     * Get the Mandrill template name from either a template name or a GH file path
     *
     * @param {String} templateName or filename
     * @return {String} templateName
     */
    getTemplateName: async function(templateOrFile=''){

      if (!templateOrFile || templateOrFile.indexOf('/') === -1) {
        return templateOrFile;
      }

      return emailVcs.getMandrillFilename(templateOrFile);

    },

    /**
     * Get the Github filename from a Mandrill template name
     *
     * @param {String} templateName
     * @return {String} filename
     */
    getGithubFilenameFromTemplateName: async function(templateName=''){

      if (!templateName || templateName.indexOf('/') !== -1) {
        return templateName;
      }

      const files = await emailVcs.getAllFilesFromGithub();

      return files.find(function(filename){
        return emailVcs.getMandrillFilename(filename) === templateName;
      });

    },

    /**
     * Get the url to a file in Github
     *
     * @param {String} filename
     * @return {String} url
     */
    getGithubLink: async function(filename){

      const fileContents = await emailVcs.getFileContentsFromGithub(filename, false);
      return fileContents.data.html_url;

    },

    /**
     * Get the contents of a file across all branches
     *
     * @param {String} filename
     * @return {String} contents
     */
    getFileContentsAcrossBranches: async function(filename){

      let files = [];
      const branches = await bot.getAllGithubBranches();

      for (let i=0; i<branches.length; i++) {

        const fileContents = await octokit.repos.getContent({
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_TEMPLATE_REPO,
          ref: branches[i],
          path: filename,
          headers: {
            'Accept': 'application/vnd.github.v3.raw'
          }
        });

        files.push({
          branch: branches[i],
          contents: fileContents.data
        });

      }

      return files;

    },

    /**
     * Get an array of all branches in Github repo
     *
     * @return {Array} branch name
     */
    getAllGithubBranches: async function(){

      const branches = await bot.octokit.repos.getBranches({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_TEMPLATE_REPO
      });

      return branches.data.map(function(branch){
        return branch.name;
      });

    },

    /**
     * Get a PDF of a template
     *
     * @param {String} templateName
     * @param {String} filename
     * @return {fs.ReadStream} PDF ReadStream
     */
    getPdfFromTemplate: async function(templateName, filename){

      const fileContents = await emailVcs.getFileContentsFromGithub(filename);
      const parsedFile = emailVcs.parseMarkdown(fileContents.data);

      const html = bot.getTemplateHtml({
        'Name': templateName,
        'Filename': filename,
        'From Email': parsedFile['From Email'],
        'From Name': parsedFile['From Name'],
        'Labels': parsedFile['Labels'],
        'Subject': parsedFile['Subject'],
        'Html': parsedFile['Html'],
        'Text': parsedFile['Text']
      });

      const pdf = await bot.getPdfFromHtml(html);
      return pdf;

    },

    /**
     * Get a PDF of a template versions across all branches
     *
     * @param {String} templateName
     * @param {String} filename
     * @return {fs.ReadStream} PDF ReadStream
     */
    getPdfCompareAcrossBranchesFromTemplate: async function(templateName, filename){

      const files = await bot.getFileContentsAcrossBranches(filename);

      //format, add branch name, and add page breaks
      const html = files.map(function(file){

        const parsedFile = emailVcs.parseMarkdown(file.contents);
        return `<h1>Branch: ${file.branch}</h1><br />` + bot.getTemplateHtml({
          'Name': templateName,
          'Filename': filename,
          'From Email': parsedFile['From Email'],
          'From Name': parsedFile['From Name'],
          'Labels': parsedFile['Labels'],
          'Subject': parsedFile['Subject'],
          'Html': parsedFile['Html'],
          'Text': parsedFile['Text']
        });

      }).join('<p style="page-break-before: always">');

      const pdf = await bot.getPdfFromHtml(html);
      return pdf;

    },

    /**
     * Parse files from a zip
     *
     * @param {String} zipPath
     * @return {Array} files
     */
    readFilesFromZip: async function(zipPath){

      return new Promise(function(resolve, reject){

        let files = [];

        //extract the zip
        fs.createReadStream(zipPath)
        .pipe(unzip.Parse())
        .on('entry', function(entry){

          //read each file
          let contents = '';

          entry
          .on('data', function(chunk){
              contents += chunk;
          })
          .on('end', function(){

            const filename = entry.path;

            //only return markdown files
            if (filename.indexOf('.md') === -1) {
              return;
            }

            //remove README
            if (filename.indexOf('README.md') !== -1) {
              return;
            }

            //remove hidden files
            if (filename.split('/').pop().charAt(0) === '.') {
              return;
            }

            //remove zip name from path if needed
            const path = (function(path){
              path = path.split('/');
              if (path.length > 1) {
                path.shift();
              }
              return path.join('/');
            })(filename);

            //append to files array
            files.push({
              name: path,
              contents: contents
            });

          });

        }).on('close', function(){

          resolve(files);

        });

      });

    },

    /**
     * Get a PDF of all templates
     *
     * @return {fs.ReadStream} PDF ReadStream
     */
    getPdfOfAllTemplates: async function(){

      //download zip archive from github
      const archive = await bot.octokit.repos.getArchiveLink({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_TEMPLATE_REPO,
        archive_format: 'zipball',
        ref: process.env.GITHUB_SYNC_BRANCH
      });

      //save the zip
      const tmp = '/tmp/' + Math.random().toString(36).slice(2) + '.zip';
      fs.writeFileSync(tmp, archive.data, 'binary');

      //read the files from the zip
      const files = await bot.readFilesFromZip(tmp);

      //format, add data, and add page breaks
      const html = files.map(function(file){

        const parsedFile = emailVcs.parseMarkdown(file.contents);
        const templateName = emailVcs.getMandrillFilename(file.name);
        return bot.getTemplateHtml({
          'Name': templateName,
          'Filename': file.name,
          'From Email': parsedFile['From Email'],
          'From Name': parsedFile['From Name'],
          'Labels': parsedFile['Labels'],
          'Subject': parsedFile['Subject'],
          'Html': parsedFile['Html'],
          'Text': parsedFile['Text']
        });

      }).join('<p style="page-break-before: always">');

      //generate pdf
      const pdf = await bot.getPdfFromHtml(html);
      return pdf;

    },

    /**
     * Get template as formatted HTML
     *
     * @param {Object} template data
     * @return {String} Template HTML
     */
    getTemplateHtml: function(template){

      return `
        <h1>Template: ${template['Name']}</h1><br />
        <h1>Path: ${template['Filename']}</h1><br />

        <h2>From Email: ${template['From Email']}</h2><br />
        <h2>From Name: ${template['From Name']}</h2><br />
        <h2>Labels:</h2>
        <ul>
        ${template.Labels.map(function(label){
          return '<li>' + label + '</li>';
        }).join('')}
        </ul><br />
        <h2>Subject: ${template.Subject}</h2><br />
        <h2>HTML:</h2><br />
        ${template.Html}
        <h2>Text:</h2><br />
        ${template.Text}
      `;

    },

    /**
     * Generate a PDF from HTML
     *
     * @param {String} html
     * @return {fs.ReadStream} PDF ReadStream
     */
    getPdfFromHtml: function(html){

      return new Promise(function(resolve, reject){

        //prepend some style
        html = `<style type="text/css">
                  html {
                    font-family: sans-serif;
                  }
                  br {
                    content: "";
                    margin: 2em;
                    display: block;
                    font-size: 24%;
                  }
                </style>
                ${html}`;

        const tmp = '/tmp/' + Math.random().toString(36).slice(2) + '.pdf';
        const writeStream = fs.createWriteStream(tmp);

        wkhtmltopdf(html, {
          disableSmartShrinking: true,
          dpi: 196
        }, function(){}).pipe(writeStream);

        writeStream.on('finish', function(){
          resolve(fs.createReadStream(tmp));
        });

      });

    },

    /**
     * Handle request to process action
     *
     * @param {Object} event
     * @param {Object} context
     * @param {Function} callback
     * @return {Function} callback
     */
    handler: async function(event, context, callback){

      let upload = {ok: false};
      let successMsg = '';
      const body = (function(event){
        if (typeof event.body === 'string') {
          try {
            return JSON.parse(event.body);
          }
          catch(e) {
            return queryString.parse(event.body);
          }
        }
        return event.body;
      })(event);
      const token = process.env.PROCESS_ACCESS_TOKEN;
      const action = body.action;
      const channelId = body.channel_id;
      const templateFile = await bot.getGithubFilenameFromTemplateName(body.template_name);
      const templateName = await bot.getTemplateName(body.template_name);

      if (body.token !== token) {
          const errMsg = 'Invalid request token';
          return callback(null, {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: errMsg
            })
          });
      }


      //read single template command
      if (action === 'template') {

        const filename = templateName + '.pdf';
        successMsg = 'Generating PDF for ' + templateName;

        const pdf = await bot.getPdfFromTemplate(templateName, templateFile);

        try {
          upload = await bot.uploader.uploadPdf(channelId, filename, pdf);
        }
        catch(e){}

      }

      //read template compare command
      if (action === 'compare') {

        const filename = templateName + '-compare.pdf';
        successMsg = 'Generating PDF for ' + templateName + ' across branches';

        const pdf = await bot.getPdfCompareAcrossBranchesFromTemplate(templateName, templateFile);

        try {
          upload = await bot.uploader.uploadPdf(channelId, filename, pdf);
        }
        catch(e){}

      }

      //read all templates
      if (action === 'all') {

        const filename = 'all-templates.pdf';
        successMsg = 'Generating PDF for all templates';

        const pdf = await bot.getPdfOfAllTemplates();

        try {
          upload = await bot.uploader.uploadPdf(channelId, filename, pdf);
        }
        catch(e){}

      }


      //success
      if (upload.ok) {

        return callback(null, {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: successMsg
          })
        });

      }

      //fail
      const errMsg = upload.error || 'No action requested';
      return callback(null, {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: errMsg
        })
      });

    }

  };

  return bot;

})();
