delete require.cache;
require('dotenv').config();
const debug = process.env.DEBUG === 'true';
const bot = require('../process.js');
const assert = require('assert');
const fs = require('fs');
const pdfParser = require("pdf2json");

const parsePdf = function(pdfStream){

  return new Promise(async function(resolve, reject){

    pdfStream
    .pipe(new pdfParser())
    .on("pdfParser_dataReady", function(pdfData){

      if (typeof pdfData !== 'undefined' && typeof pdfData.formImage !== 'undefined' && typeof pdfData.formImage.Pages !== 'undefined') {

        //parse for text only
        const pdfText = pdfData.formImage.Pages.map(function(page) {

          return page.Texts
            .map(function(text){
              return text.R[0].T;
            })
            .map(decodeURIComponent)
            .join('');

        });

        resolve(JSON.stringify(pdfText).replace(/[^a-zA-Z0-9]/gi,''));

      }
      else {

        reject(pdfData);

      }

    });

  });

};


describe('process.js', function() {

  describe('#getGithubFilenameFromTemplateName', function() {
    it('returns the github filename from a template name', async function() {

      const expectedGithubFilename = 'test/template.md';
      const templateName = 'test-template';

      const githubFilename = await bot.getGithubFilenameFromTemplateName(templateName);

      assert.equal(githubFilename, expectedGithubFilename);

    });

    it('returns the github filename from a github file name', async function() {

      const expectedGithubFilename = 'test/template.md';
      const templateName = 'test/template.md';

      const githubFilename = await bot.getGithubFilenameFromTemplateName(templateName);

      assert.equal(githubFilename, expectedGithubFilename);

    });
  });

  describe('#getTemplateName', function() {
    it('returns a template name from a github file name', async function() {

      const expectedGithubFilename = 'test-template';
      const templateName = 'test/template.md';

      const githubFilename = await bot.getTemplateName(templateName);

      assert.equal(githubFilename, expectedGithubFilename);

    });

    it('returns a template name from a template name', async function() {

      const expectedGithubFilename = 'test-template';
      const templateName = 'test-template';

      const githubFilename = await bot.getTemplateName(templateName);

      assert.equal(githubFilename, expectedGithubFilename);

    });
  });

  describe('#getGithubLink', function() {
    it('returns the link to a template in github', async function() {

      const expectedGithubLink = 'https://github.com/coalharbourgroup/email-vcs-templates/blob/master/test/template.md';
      const filename = 'test/template.md';
      const githubLink = await bot.getGithubLink(filename);

      assert.equal(githubLink, expectedGithubLink);

    });
  });

  describe('#getAllGithubBranches', function() {
    it('returns all the branches in github', async function() {

      //overload octokit getBranches function
      const getBranches = bot.octokit.repos.getBranches;
      bot.octokit.repos.getBranches = function(){
        return {
          data: [{
            name: 'test'
          }]
        };
      };

      //verify
      const expectedBranches = ['test'];
      const githubBranches = await bot.getAllGithubBranches();

      assert.deepEqual(expectedBranches, githubBranches);

      //cleanup
      bot.octokit.repos.getBranches = getBranches;

    });
  });

  describe('#getFileContentsAcrossBranches', function() {
    it('returns the contents of a file across all branches', async function() {

      const template = fs.readFileSync(__dirname + '/mocks/template.md', 'utf8');

      //overload octokit functions
      const getBranches = bot.octokit.repos.getBranches;
      bot.octokit.repos.getBranches = function(){
        return {
          data: [{
            name: 'test'
          }]
        };
      };

      const getContent = bot.octokit.repos.getContent;
      bot.octokit.repos.getContent = function(){
        return {
          data: template
        };
      };


      const expectedFiles = [{
        branch: 'test',
        contents: template
      }];
      const filename = 'test/template.md'
      const files = await bot.getFileContentsAcrossBranches(filename);

      assert.deepEqual(files, expectedFiles);


      //cleanup
      bot.octokit.repos.getBranches = getBranches;
      bot.octokit.repos.getContent = getContent;

    });
  });

  describe('#getPdfFromHtml', function() {
    it('returns a PDF given input HTML', async function() {

      const pdfNormalizationExp = /\/CreationDate \(D:.*\)/gi;
      const html = fs.readFileSync(__dirname + '/mocks/template.html', 'utf8');
      const expectedPdf = fs.readFileSync(__dirname + '/mocks/template.pdf', 'utf8').replace(pdfNormalizationExp, '');

      (await bot.getPdfFromHtml(html)).on('close', function(pdf){

        pdf = pdf.replace(pdfNormalizationExp, '');

        //verify
        assert.equal(pdf, expectedPdf);

      });

    });
  });

  describe('#getPdfFromTemplate', function() {
    it('returns a PDF from Github data given a template name', async function() {

      const filename = 'test/template.md';
      const templateName = 'test-template';

      const expectedPdf = await parsePdf(fs.createReadStream(__dirname + '/mocks/template.pdf'));

      const pdfStream = await bot.getPdfFromTemplate(templateName, filename);
      const parsedPdf = await parsePdf(pdfStream);

      //verify
      assert.deepEqual(parsedPdf, expectedPdf);

    });

  });

  describe('#getPdfCompareAcrossBranchesFromTemplateName', function() {
    it('returns a PDF of files across branches given a template name', async function() {

      const filename = 'test/template.md';
      const templateName = 'test-template';

      const expectedPdf = await parsePdf(fs.createReadStream(__dirname + '/mocks/templateCompare.pdf'));

      const pdfStream = await bot.getPdfCompareAcrossBranchesFromTemplate(templateName, filename);
      const parsedPdf = await parsePdf(pdfStream);

      //verify
      assert.deepEqual(parsedPdf, expectedPdf);

    });
  });

  describe('#readFilesFromZip', function() {

    it('returns an array of files from a zip', async function() {

      const zip = __dirname + '/mocks/template.zip';
      const expectedResponse = [{
        name: 'template.md',
        contents: '# Subject\nPassword reset request\n\n# Html\n<div mc:edit="header">\n    <p>*|FNAME|*,</p>\n    <p>We received a request to reset the password associated with this e-mail address.</p>\n</div>\n<div mc:edit="main">\n    <p>If you made this request, to reset your password using our secure server <a href="https://app.parkingmobility.com/forgotpassword/*|URL|*">please click here</a>.</p>\n    <p>If you did not request to have your password reset you can safely ignore this email. Rest assured your customer account is safe.</p>\n    <p>Parking Mobility will never e-mail you and ask you to disclose or verify your password or any other personal information. If you receive a suspicious e-mail with a link to update your account information, do not click on the link. Instead, please send us an email at support@parkingmobility.com.</p>\n    <br/>\n</div>\n<div mc:edit="footer">\nAccessibly yours,<br/>\nThe Parking Mobility Team\n</div>\n\n# Text\n\n\n# Labels\n* changepassword\n\n# From Email\nsupport@parkingmobility.com\n\n# From Name\nParking Mobility\n\n'
      }];

      const files = await bot.readFilesFromZip(zip);

      assert.deepEqual(files, expectedResponse);

    });

  });

  describe('#getPdfOfAllTemplates', function() {

    it('returns a PDF of all files in Github sync branch', async function() {

      const expectedPdf = await parsePdf(fs.createReadStream(__dirname + '/mocks/templateAllFiles.pdf'));

      const pdfStream = await bot.getPdfOfAllTemplates();
      const parsedPdf = await parsePdf(pdfStream);

      //verify
      assert.deepEqual(parsedPdf, expectedPdf);

    });
  });

  describe('#handler', async function() {

    it('fails with an invalid token', async function() {

      let event = require('./mocks/processTemplateEvent.json');
      const PROCESS_ACCESS_TOKEN = process.env.PROCESS_ACCESS_TOKEN;
      process.env.PROCESS_ACCESS_TOKEN = 'invalidToken';

      await bot.handler(event, {}, async function(e, response){

        assert.equal(response.body, JSON.stringify({text:'Invalid request token'}));

      });

      //cleanup
      process.env.PROCESS_ACCESS_TOKEN = PROCESS_ACCESS_TOKEN;

    });

    it('uploads a PDF of a template from github', async function() {

      //overload request.post for uploads
      const requestPost = bot.uploader.request.post;
      bot.uploader.request.post = function(data, callback){
        callback(null, {body: '{"ok": true}'});
      };

      const event = require('./mocks/processTemplateEvent.json');
      const expectedResponse = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({text: 'Generating PDF for test-template'})
      };

      await bot.handler(event, {}, async function(e, response){

        //verify
        assert.deepEqual(response, expectedResponse);

      });

      //cleanup
      bot.uploader.request.post = requestPost;

    });

    it('uploads a PDF of files across branches given a template name', async function() {

      //overload request.post for uploads
      const requestPost = bot.uploader.request.post;
      bot.uploader.request.post = function(data, callback){
        callback(null, {body: '{"ok": true}'});
      };

      const event = require('./mocks/processTemplateCompareEvent.json');
      const expectedResponse = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({text: 'Generating PDF for test-template across branches'})
      };

      await bot.handler(event, {}, async function(e, response){

        //verify
        assert.deepEqual(response, expectedResponse);

      });

      //cleanup
      bot.uploader.request.post = requestPost;

    });

    it('uploads a PDF of all files in Github sync branch', async function() {

      //overload request.post for uploads
      const requestPost = bot.uploader.request.post;
      bot.uploader.request.post = function(data, callback){
        callback(null, {body: '{"ok": true}'});
      };

      const event = require('./mocks/processTemplateAllEvent.json');
      const expectedResponse = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({text: 'Generating PDF for all templates'})
      };

      await bot.handler(event, {}, async function(e, response){

        //verify
        assert.deepEqual(response, expectedResponse);

      });

      //cleanup
      bot.uploader.request.post = requestPost;

    });

    it('returns an error when upload fails', async function() {

      //overload request.post for uploads
      const requestPost = bot.uploader.request.post;
      bot.uploader.request.post = function(data, callback){
        callback(null, {body: '{"ok": false, "error": "Upload failed"}'});
      };

      const event = require('./mocks/processTemplateEvent.json');
      const expectedResponse = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({text: 'Upload failed'})
      };

      await bot.handler(event, {}, async function(e, response){

        //verify
        assert.deepEqual(response, expectedResponse);

      });

      //cleanup
      bot.uploader.request.post = requestPost;

    });

    it('returns an error when no action arg is sent', async function() {

      //overload request.post for uploads
      const requestPost = bot.uploader.request.post;
      bot.uploader.request.post = function(data, callback){
        callback(null, {body: '{"ok": false, "error": "No action requested"}'});
      };

      const event = require('./mocks/processTemplateEvent.json');
      event.body.text = '';
      const expectedResponse = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({text: 'No action requested'})
      };

      await bot.handler(event, {}, async function(e, response){

        //verify
        assert.deepEqual(response, expectedResponse);

      });

      //cleanup
      bot.uploader.request.post = requestPost;

    });

  });

});