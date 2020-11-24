require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const fs = require('fs'); 
const path = require('path'); 
const multer = require('multer'); 



var name;
var user_id;
var login_id;


const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const { strict } = require('assert');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.json()) 

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/SECRETSDB", {useNewUrlParser: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema ({
  name:String,
  email: String,
  password: String,
  question:String,
  answer:String,
  googleId: String,
  secret: Array,
});


var profileSchema= new mongoose.Schema({
  userIdname:String,
  img: 
  { 
      data: Buffer, 
      contentType: String 
  }
});

var imageSchema = new mongoose.Schema({ 
  userIdname:String,
  likes:Number,
  img: 
  { 
      data: Buffer, 
      contentType: String 
  } 
}); 





userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const User = new mongoose.model("User", userSchema);
const profile =mongoose.model('profile', profileSchema);
const imgs =mongoose.model('Image', imageSchema);


passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));



const storage = multer.diskStorage({ 
  destination: (req, file, cb) => { 
      cb(null, 'uploads') 
  }, 
  filename: (req, file, cb) => { 
      cb(null, file.fieldname + '-' + Date.now()) 
  } 
}); 

const upload = multer({ storage: storage });







app.get("/", function(req, res){
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    res.redirect("/secrets");
  });

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/forgotPassword", function(req, res){
  if(req.isAuthenticated()){
    res.redirect("/secrets");
  }else{
  res.render("forgotPassword");
  }
});


app.get("/register", function(req, res){
  res.render("register");
});
app.get("/forgotPassword/changePassword", function(req, res){
  if(req.isAuthenticated()){
    res.redirect("/secrets");
  }else{
  res.render("changePassword");
  }  
});




app.get("/secrets", function(req, res){
  if(req.isAuthenticated()){
    User.find({"secret": {$ne: null}}, function(err, foundUsers){
      if (err){
        console.log(err);
      } else {
        if (foundUsers) {
          res.render("secrets", {usersWithSecrets: foundUsers});
        }
      }
    });
  }else{
    res.redirect("/");
  }
});

app.get("/submit", function(req, res){
  if (req.isAuthenticated()){
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function(req, res){
  const submittedSecret = req.body.secret;
  User.findById(req.user.id, function(err, foundUser){
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        User.findByIdAndUpdate(req.user.id,{$push:{secret:submittedSecret}},
          {safe:true, upsert:true},function(err,doc){
              if(err){
                console.log(err);
              }else{
                res.redirect("/secrets");
              }

          })
      }
    }
  });
});


app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.post("/register", upload.single('image'),function(req, res){




  User.register({username: req.body.username,full_name:req.body.full_name,question:req.body.question,answer:req.body.answer},req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      const obj = {
        userIdname:req.body.username, 
        img: { 
            data: fs.readFileSync(path.join(__dirname + '/uploads/'+ req.file.filename)), 
            contentType: 'image/png'
        } 
    } 
    profile.create(obj, (err, item) => { 
        if (err) { 
            console.log(err); 
        } 
        else { 
             
            passport.authenticate("local")(req, res, function(){
              item.save();
              name=req.user.username;
              res.redirect("/secrets");
            }); 
        } 
    }); 
    }
  });

});

app.post("/login", function(req, res){





  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        name=req.user.username;
        res.redirect("/secrets");
      });
    }
  });

});



app.get('/gallery', (req, res) => { 
  if(req.isAuthenticated()){
  imgs.find({}, (err, items) => { 
      if (err) { 
          console.log(err); 
      } 
      else {
        profile.find({}, (err, profs) => { 
          if (err) { 
              console.log(err); 
          } 
          else { 
              res.render('gallery', { items: items, profs:profs });
          } 
      });  
      } 
  }); 
}else{
  res.redirect("/");
}
});



app.post('/up', upload.single('image'), (req, res, next) => { 
  
  const obj = { 
      userIdname:name,
      likes:0,
      img: { 
          data: fs.readFileSync(path.join(__dirname + '/uploads/'+ req.file.filename)), 
          contentType: 'image/png'
      } 
  } 
  imgs.create(obj, (err, item) => { 
      if (err) { 
          console.log(err); 
      } 
      else { 
          item.save(); 
          res.redirect('/secrets'); 
      } 
  }); 
}); 





app.post("/like/:id", function (req, res) {
  imgs.findById(req.params.id, function (err, theUser) {
      if (err) {
          console.log(err);
      } else {
        if(name===theUser.userIdname){
        }else{
          theUser.likes += 1;
          theUser.save();
          res.send({items: theUser}); 
      }
    }
  });
});


app.post("/del/:id/:name", function (req, res) {
  if(name===req.params.name ){
      imgs.deleteOne({_id:req.params.id},function(err,obj){
        if(err){
          console.log(err);
        }else{
          res.send("True");
        }
      });
  }else
  {
  res.send("False");
  }
});






app.post("/forgotPassword", function(req, res){

      User.find({username:req.body.username}, (err, items) => { 
          if (err) { 
              console.log(err); 
          } 
          else { 
            if(items[0].username === req.body.username && items[0].question===req.body.question &&
              items[0].answer === req.body.answer){
              user_id=items[0]._id;  
              res.redirect("/forgotPassword/changePassword");
              }else{
                res.redirect("/");
              }
          } 
      }); 
});

app.post("/forgotPassword/changePassword", function(req, res){

  if(req.body.password===req.body.re_password){
    
    User.findOne({_id:user_id}, (err, items) => { 
      if (err) { 
          console.log(err); 
      } 
      else { 
       items.setPassword(req.body.password, function(err, items){
          if(err){
            res.redirect("/");
          }else{
            items.save();
            user_id=null;
            res.redirect("/login")
          }

        });

      } 
  });
  }

});




app.listen(process.env.PORT||3000, function() {
  console.log("Server started on port 3000.");
});
