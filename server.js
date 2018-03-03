var http = require("http"),
	request = require("superagent"),
	install = require('superagent-charset'),
	cheerio = require("cheerio"),
	async = require("async"),
	eventproxy = require("eventproxy"),
	Promise = require("promise"),
	fs = require("fs"),
	mysql = require('mysql'),
	config = require('./config.js');

var superagent = install(request);
var connection = mysql.createConnection(config);
// update statment
var sql = `insert into user(
	workCity,
	heightEdu,
	ZXHideFlag,
	marriage,
	zhenxintrial,
	h,
	objIsVip,
	heightSalary,
	v,
	height,
	nickName,
	isStar,
	vipHideFlag,
	age,
	isMailHot,
	zhenxin,
	notOpenPrivacy,
	memberId,
	photopath) values ? `;

var catchFirstUrl = "http://search.zhenai.com/v2/search/pinterest.do", //入口页面
	catchDate = [], //存放爬取数据
	pageUrls = [], //存放所有url
	pageNum = 5, //要爬取的页数
	dir = './images',//本地存储目录
	deleteRepeat = [],
	downloadCount = 0,//下载的所有图片
	startDate = new Date(), //开始时间
	promiseArrays = [],//存放所有的promise
	endDate = false; //结束时间

for (var i = 1; i <= pageNum; i++) {
	pageUrls.push("http://search.zhenai.com/v2/search/getPinterestData.do?sex=1&agebegin=18&ageend=33&workcityprovince=10101000&workcitycity=10101204&marriage=1&marriage=4&h1=-1&h2=-1&salaryBegin=-1&salaryEnd=-1&occupation=-1&h=-1&c=-1&workcityprovince1=-1&workcitycity1=-1&constellation=-1&animals=-1&stock=-1&belief=-1&condition=66&orderby=hpf&hotIndex=0&online=&currentpage="+i+"&topSearch=true");
}

//请求头数据--伪装已登录状态
var headers = {
	"Accept": "application/json",
	"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36",
	"Cookie": "gr_user_id=df42e942-89f1-4457-bf14-a00f5ed2b7dc; login_health=026184f8150adaedf915661113e0c766981fcafaf281b5410ee072534f4515d7cee54ccea122cc7e705b8e410348bd843be503fe76478507a42a09b992d597b3; preLG_1834290796=2018-01-12+08%3A16%3A20; isSignOut=%5E%7ElastLoginActionTime%3D1518006208881%5E%7E; p=%5E%7Eworkcity%3D10101204%5E%7Elh%3D1834290796%5E%7Esex%3D1%5E%7Enickname%3D%E9%A9%AC%E5%B0%8F%E5%B8%85%5E%7Emt%3D1%5E%7Eage%3D24%5E%7Edby%3Dd4dc70c7eab40dcd%5E%7E; mid=%5E%7Emid%3D1834290796%5E%7E; loginactiontime=%5E%7Eloginactiontime%3D1518006208881%5E%7E; logininfo=%5E%7Elogininfo%3D18813926576%5E%7E; rmpwd=%5E%7Eloginmode%3D9%5E%7Elogininfo%3D18813926576%5E%7E;",
	"Referer": "http://search.zhenai.com/v2/search/pinterest.do"
};


//下载方法
var download = function(url, dir, filename){
		var dirname = dir + "/" + filename + ".png";
		if (fs.existsSync(dirname)) {
			return true;
		}
		superagent(url).pipe(fs.createWriteStream(dirname));
};

// 判断图片是否重复
var isRepeat = function (authorName) {
	if (deleteRepeat[authorName] == undefined) {
		deleteRepeat[authorName] = 1;
		return 0;
	} else if (deleteRepeat[authorName] == 1) {
		return 1;
	}
}
//打印结果
var printResult = function (res, err, result) {
	endDate = new Date();

	console.log("final:");
	console.log(result);
	//统计结果
	res.write("<br/>");
	res.write("<br/>");
	res.write("/**<br/>");
	res.write(" * 统计结果<br/>");
	res.write("**/<br/>");
	res.write("1、爬虫开始时间：" + startDate + "<br/>");
	res.write("2、爬虫结束时间：" + endDate + "<br/>");
	res.write(
		"3、耗时：" +
			(endDate - startDate) +
			"ms" +
			" --> " +
			Math.round((endDate - startDate) / 1000 / 60 * 100) / 100 +
			"min <br/>"
	);
	res.write("4、爬虫遍历的图片数目：" + downloadCount + "<br/>");
	res.write("<br/>");
	res.write("<br/>");
}

// 获取列表内容url
var getURL = function (pageUrl) {
    return new Promise(function(resolve, reject){
		superagent
			.get(pageUrl)
			.charset('gbk')
			.set(headers)
			.then(function (listData, err) {
				// 常规的错误处理
				if (err) {
					reject(err);
					return;
				}
				resolve(listData);
			});
	});
}

//控制并发数
var curCount = 0;
var reptileMove = function (res, dataItem, callback) {
	var memberId = dataItem.memberId;
	//拼凑详情页url
	var detailUrl = "http://album.zhenai.com/u/"+memberId+"?flag=s";
	//延迟毫秒数
	var delay = parseInt((Math.random() * 30000000) % 1000, 10);
	curCount++;
	console.log("现在的并发数是", curCount, "，正在下载的是", detailUrl, "，耗时" + delay + "毫秒");
	res.write(detailUrl + "<br/>");
	
	request
		.get(detailUrl)
		.set(headers)
		.then(function (pres, err) {
		// 常规的错误处理
		if (err) {
			console.log(err);
			return;
			}
		var $ = cheerio.load(pres.text);
		var imgs = $("#AblumsThumbsListID img.hidden");
		for (var i = 0; i < imgs.length; i++){
			var imgUrl = $(imgs[i]).attr('src');
			var flag = isRepeat(imgUrl);
			if (!flag) {
				downloadCount++;
				//下载图片
				download(imgUrl, dir, memberId + "-" + i);
			}
			
		}	
	});

	setTimeout(function() {
		curCount--;
		callback(null, detailUrl + "Call back content");
	}, delay);
}

// 主start程序
function start() {
	function onRequest(req, res) {
		// 设置字符编码(去掉中文会乱码)
		res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
		
		// 轮询 所有美女信息列表页
		pageUrls.forEach(function(pageUrl) {
			promiseArrays.push(getURL(pageUrl));
		});

		// 当所有 列表内容获取完成后的回调触发下面事件
		Promise.all(promiseArrays).then(function (results) {

			// 要下载的所有图片链接
			res.write("要下载的所有图片链接：<br/>");

			results.forEach(function(listData){
				var text = JSON.parse(listData.text);
				var sqlData = [];	
				text.data.forEach(function (item) {
					catchDate.push(item);
					delete item.introduceContent;
					sqlData.push(Object.values(item));
				});
				
				// 保存数据到数据库
				connection.query(sql, [sqlData], (error, results, fields) => {
					if (error){
						return console.error(error.message);
					}
					console.log('保存到数据库的条数:', results.affectedRows);
				});


				/* 
					使用async控制异步抓取
					mapLimit(arr, limit, iterator, [callback])
					异步回调
				*/
				async.mapLimit(
					catchDate,
					5,
					function(dataItem, callback) {
						reptileMove(res, dataItem, callback);
					},
					function (err, result) {
						printResult(res, err, result);
					}
				);
			});
			connection.end();
			
		}).catch(function(err){
			console.log(err);
		});

	}

	http.createServer(onRequest).listen(5001);
}

exports.start = start;
