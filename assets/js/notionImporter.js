const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const moment = require('moment');
const path = require('path');
const fs = require('fs');

const notion = new Client({
	auth: process.env.NOTION_TOKEN,
});

const n2m = new NotionToMarkdown({ notionClient: notion });

(async () => {
	// Ensure the _posts directory exists
	const root = path.join('_posts');
	fs.mkdirSync(root, { recursive: true });

	const databaseId = process.env.DATABASE_ID;

	// Fetch pages from Notion database with updated filtering
	const response = await notion.databases.query({
		database_id: databaseId,
		filter: {
			and: [
				{
					property: "태그",
					multi_select: {
						contains: "blog"
					}
				},
				{
					property: "상태",
					status: {
						equals: "완로"
					}
				}
			]
		}
	});

	for (const r of response.results) {
		const id = r.id;

		// Extract and format the date
		let date = moment(r.last_edited_time).format("YYYY-MM-DD");
		let pdate = r.properties?.['Date']?.['date']?.['start'];
		if (pdate) {
			date = moment(pdate).format('YYYY-MM-DD');
		}

		// Extract the title
		let title = id;
		let ptitle = r.properties?.['Post']?.['title'];
		if (ptitle?.length > 0) {
			title = ptitle[0]?.['plain_text'];
		}

		// Generate the expected file name
		const ftitle = `${date}-${title.replaceAll(' ', '-').toLowerCase()}.md`;
		const filePath = path.join(root, ftitle);

		// Check if the file already exists
		if (fs.existsSync(filePath)) {
			console.log(`File already exists: ${filePath}. Skipping.`);
			continue; // Skip to the next entry
		}

		// Extract tags
		let tags = [];
		let ptags = r.properties?.['Tags']?.['multi_select'];
		if (ptags) {
			for (const t of ptags) {
				const n = t?.['name'];
				if (n && n !== 'blog') {
					tags.push(n);
				}
			}
		}

		// Construct the front matter
		let fmtags = '';
		let fmcats = '';
		if (tags.length > 0) {
			fmtags += '\ntags:\n';
			for (const t of tags) {
				fmtags += '  - ' + t + '\n';
			}
		}

		const fm = `---
layout: post
date: ${date}
title: ${title}
tags: ${fmtags}
author: 'Seungheon Lee'
---
`;

		// Convert the Notion page to Markdown
		const mdblocks = await n2m.pageToMarkdown(id);
		const md = n2m.toMarkdownString(mdblocks);

		// Write the Markdown file
		fs.writeFile(filePath, fm + md, (err) => {
			if (err) {
				console.log(err);
			} else {
				console.log(`File created: ${filePath}`);
			}
		});
	}
})();
