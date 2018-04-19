
var app = angular.module("accApp", ['ui.router', 'angular.filter']);


app.config(function($stateProvider, $urlRouterProvider) {

    $urlRouterProvider.otherwise('/home');

    $stateProvider
        .state('login',
            {
                url: '/login',
                templateUrl: 'login.html'
            })
        .state('list',
            {
                url: '/list',
                templateUrl: 'list.html'
            })
        .state('add',
            {
                url: '/add/:type',
                templateUrl: 'addAccountDetails.html'
            })
        .state('edit',
            {
                url: '/edit/:id/:type',
                templateUrl: 'addAccountDetails.html',
                params: {
                    id: null,
                    type: null
                }
            });

    $urlRouterProvider.otherwise('/login');
});

app.controller("RootController",
    [
        '$state', '$rootScope', function($state, $rootScope) {
            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    // User is signed in.
                    $rootScope.user = user;
                    $rootScope.isLoggedIn = true;
                    if (!$rootScope.selectedProject) {
                        $state.go("list")
                    }

                } else {
                    // No user is signed in.
                    $rootScope.user = null;
                    $rootScope.isLoggedIn = false;
                    $state.go("login");
                }
            });
        }
    ]);


app.controller("LoginController",
    [
        '$scope', '$rootScope', '$state', function($scope, $rootScope, $state) {
            var self = this;

            self.onLoginClick = function(email, password) {
                firebase.auth().signInWithEmailAndPassword(email, password).then(function(user) {
                    $rootScope.isLoggedIn = true;
                    $rootScope.user = user;
                    $state.go("list");
                }).catch(function(error) {
                    $scope.$evalAsync(function() {
                        self.errorCode = error.code;
                        self.errorMessage = error.message;
                        $rootScope.isLoggedIn = false;
                    });
                });
            }

        }
    ]);

app.controller("ListAccountController",
    [
        '$state', '$scope', '$rootScope', function($state, $scope, $rootScope) {
            var self = this;

            var projectsRef = firebase.database().ref('projects/');

            self.onAddTransaction = function() {
                $state.go("add", { type: self.selectedTab });
            };

            self.onAddProject = function() {
                var projectName = prompt("Please enter the project name");
                if (projectName) {
                    projectsRef.push({
                        name: projectName
                    });
                }
            }

            self.onSettleCredit = function (item) {

                var settlementAmount = prompt("Please enter settlement amount", (item.amount - item.settlementAmount));
                settlementAmount = parseFloat(settlementAmount);

                if (isNaN(settlementAmount)) {
                    alert("Invalid amount");
                    return;
                }

                var accDetail = firebase.database().ref('accountDetails/' + item.id);
                accDetail.once('value',
                    function (snapshot) {
                        var details = snapshot.val();
                        details.settlementAmount = (details.settlementAmount || 0) + settlementAmount;
                        details.isCreditSettled = (details.settlementAmount === details.amount);
                        accDetail.update(details);

                        alert("Amount Rs." +
                            settlementAmount.toString() +
                            " is settled." +
                            "Balance settlement amount is Rs." +
                            (details.amount -
                            details.settlementAmount).toString());
                    });
            }

            self.getSum = function(values, type) {
                var sum = 0;
                values.forEach(function(each) {
                    if (each.type === type) {
                        sum += each.amount;
                    }
                });

                return sum;
            }

            var accountDetailsRef = firebase.database().ref('accountDetails/');


            projectsRef.on('value',
                function(snapshot) {
                    $scope.$evalAsync(function() {
                        var val = snapshot.val();
                        var arr = Object.keys(val).map(function(key) {
                            var x = val[key];
                            x.id = key;
                            return x;
                        });
                        self.projects = arr;
                    });
                });

            accountDetailsRef.on('value',
                function(snapshot) {
                    self.users = {};
                    var i = 1;
                    $scope.$evalAsync(function() {
                        var val = snapshot.val();
                        var arr = Object.keys(val).map(function(key) {
                            var x = val[key];
                            x.id = key;
                            x.isCreditSettled = !!x.isCreditSettled;
                            if (!self.users[x.createdBy]) {
                                self.users[x.createdBy] = "user-" + i++;
                            }
                            return x;
                        });
                        self.accountDetails = arr;
                    });
                });

        }
    ]);

app.controller("AddEditAccountDetailsController",
    [
        '$scope', '$rootScope', '$state', function ($scope, $rootScope, $state) {
            var self = this;

            self.vendors = [];
            self.date = new Date();
            self.type = $state.params.type;

            var projectsRef = firebase.database().ref('projects/');
            var vendorsRef = firebase.database().ref('vendors/');
            var accountDetailsRef = firebase.database().ref('accountDetails/');


            if ($state.current.name === "edit") {
                var id = $state.params.id;
                var accDetail = firebase.database().ref('accountDetails/' + id);
                accDetail.once('value',
                    function (snapshot) {
                        var details = snapshot.val();
                        $scope.$evalAsync(function () {
                            self.vendor = details.vendor;
                            self.project = details.project;
                            self.itemName = details.itemName;
                            self.amount = details.amount;
                            self.date = new Date(details.date);
                            self.type = details.type;
                            self.remarks = details.remarks;
                        });
                    });
            }

            projectsRef.on('value',
                function (snapshot) {
                    $scope.$evalAsync(function () {
                        var val = snapshot.val();
                        var arr = Object.keys(val).map(function (key) {
                            var x = val[key];
                            x.id = key;
                            return x;
                        });
                        self.projects = arr;
                    });
                });

            vendorsRef.on('value',
                function (snapshot) {
                    $scope.$evalAsync(function () {
                        var val = snapshot.val();
                        var arr = Object.keys(val).map(function (key) {
                            var x = val[key];
                            x.id = key;
                            return x;
                        });
                        self.vendors = arr;
                    });
                });

            self.onCancel = function () {
                window.history.back();
            }

            self.onSave = function () {

                var details = {
                    createdBy: $rootScope.user.email,
                    vendor: self.vendor || "Not applicable",
                    project: $rootScope.selectedProject,
                    //itemName: self.itemName,
                    amount: self.amount,
                    date: self.date.toLocaleDateString('en-US'),
                    type: self.type,
                    remarks: self.remarks
                };

                if ($state.current.name === "edit") {
                    var id = $state.params.id;
                    var accDetailRef = firebase.database().ref('accountDetails/' + id);
                    accDetailRef.update(details);
                } else {
                    accountDetailsRef.push(details);
                }
                window.history.back();
            }

            self.onVendorChanged = function (e) {
                if (self.vendor === 'addVendor') {
                    var vendorName = prompt("Please enter the vendor name");
                    if (vendorName) {
                        vendorsRef.push({
                            name: vendorName
                        });
                    }
                }
            }
        
        }
    ]);

