angular.module('equitrack.tripControllers', [])

.controller('TripCtrl', function() {
})

.controller('Report', function($stateParams){
    var vm = this;
    vm.trip_id = $stateParams.tripId;
})

.controller('ReportingText', function($scope, $stateParams, tripService, $ionicLoading, $ionicHistory, $ionicPopup, errorHandler, networkService, $translate){    
  var fields = ['main_observations', 'constraints', 'lessons_learned', 'opportunities'];
  var main_obs_template = $translate.instant('controller.report.text.observations.access') + '\n \n \n \n' +
  $translate.instant('controller.report.text.observations.quality') + '\n \n \n \n' +
  $translate.instant('controller.report.text.observations.utilisation') + '\n \n \n \n' +
  $translate.instant('controller.report.text.observations.enabling') + '\n \n \n \n';

  $scope.trip = tripService.getTrip($stateParams.tripId);

  // report submitted
  if ($scope.trip.main_observations.length > 0) {
    $scope.data = {
        main_observations : $scope.trip.main_observations,
        constraints : $scope.trip.constraints,
        lessons_learned : $scope.trip.lessons_learned,
        opportunities: $scope.trip.opportunities
    };
  } else {          
    var reportText = {};

    fields.forEach(function(field) {
      var data = tripService.getDraft($stateParams.tripId, field);

      if (data.length > 0) {
        reportText[field] = data;
      } else {
        if (field === 'main_observations') {
          reportText[field] = main_obs_template;
        } else {
          reportText[field] = '';
        }
      }
    });

    $scope.data = reportText;
  }

  $scope.autosave = function() {
    if ($scope.trip.main_observations.length === 0) {            
      fields.forEach(function(field) {
        tripService.setDraft($stateParams.tripId, field, $scope.data[field]);    
      });
    }
  };

  $scope.submit = function(){
    if (networkService.isOffline() === true) {
      networkService.showMessage();

    } else {
      $ionicLoading.show( { template: '<loading message="sending_report"></loading>' } );

      tripService.reportText($scope.data, $scope.trip.id, 
        function(succ){
          $ionicLoading.hide();
          $ionicHistory.goBack(-1);
          
          tripService.localTripUpdate($scope.trip.id, succ.data);
          
          fields.forEach(function(field) {
            tripService.deleteDraft($stateParams.tripId, field);    
          });

          $ionicPopup.alert({
              title: $translate.instant('controller.report.text.submitted.title'),
              template: $translate.instant('controller.report.text.submitted.template')
          });
        }, function(err){
          errorHandler.popError(err);
        }
      );
    }
  };
})

.controller('NotesCtrl', function($scope, $stateParams, tripService, $ionicLoading, $ionicHistory, $state, $ionicPopup, errorHandler, $translate, $ionicPlatform){
  $scope.trip = tripService.getTrip($stateParams.tripId);
  $scope.notes = tripService.getDraft($stateParams.tripId, 'notes');

  $ionicPlatform.ready(function() {    
    reset_data();
  });
  
  function reset_data(){
    $scope.data = {
        text : ($scope.notes.text) ? $scope.notes.text : "",
    };
  }
  
  $scope.saveNotes = function(){
    tripService.setDraft($stateParams.tripId, 'notes', $scope.data);
    $ionicPopup.alert({
                title: $translate.instant('controller.notes.save.title'),
                template: $translate.instant('controller.notes.save.template')
            });
  };
  $scope.discardNotes = function(){
    tripService.setDraft($stateParams.tripId, 'notes', {});
    $scope.notes = tripService.getDraft($stateParams.tripId, 'notes');
    reset_data();
    $ionicPopup.alert({
                title: $translate.instant('controller.notes.discard.title'),
                template: $translate.instant('controller.notes.discard.template')
            });
  };
})

.controller('ReportingActionPoint',function($stateParams, tripService){
    var vm = this;
    vm.trips = tripService.getTrip($stateParams.tripId);
    vm.trip_id = $stateParams.tripId;
})

.controller('ReportingActionPointEdit',
    function($scope, $stateParams, tripService, localStorageService, $ionicLoading, $ionicHistory, $ionicPopup, $state, dataService, errorHandler, $locale, networkService, $translate) {        
        var vm = this;
        vm.title = 'template.trip.report.action_point.edit.title';
        vm.isActionPointNew = false;

        if ($state.current.name.indexOf('new') > 0) {
            vm.title = 'template.trip.report.action_point.new';
            vm.isActionPointNew = true;
        }

        $scope.today = new Date();

        $scope.padded_num = function(limit){
            var result = [];
            for (var i=1; i<limit+1; i++){
                result.push(i>9 ? i+'' : "0"+i);
            }
            return result;
        };
        var currentTrip = tripService.getTrip($stateParams.tripId);

        $scope.allMonths = $locale.DATETIME_FORMATS.SHORTMONTH;
        $scope.yearOptions = [$scope.today.getFullYear()+"",
                              $scope.today.getFullYear()+1+""];

        dataService.get_user_base(
            function(successData){
                $scope.users = successData;
            },
            function(err){
                errorHandler.popError(err);
            }
        );

        if (vm.isActionPointNew === true) {
            var tomorrow = new Date($scope.today.getTime() + 24 * 60 * 60 * 1000);

            $scope.ap = {'status':'open',
                         'due_year': tomorrow.getFullYear()+"",
                         'due_month': ("0" + (tomorrow.getMonth()+1)).slice(-2),
                         'due_day': ("0" + tomorrow.getDate()).slice(-2)
                        };
        } else {
            $scope.ap = tripService.getAP(currentTrip, $stateParams.actionPointId);            
        }

        $scope.submit = function (){            
            $scope.errors = {};
            $scope.error = false;

            if (!$scope.ap.person_responsible){
                $scope.errors.person_responsible = true;
            }

            if (!$scope.ap.description){
                $scope.errors.description = true;
            }

            if (Object.keys($scope.errors).length){
                $scope.error = true;
                return;
            } else {
                if (networkService.isOffline() === true) {
                    networkService.showMessage();
                } else {
                    var loadingMessage = 'updating_action_point';
                    var alertTitle = 'controller.trip.action_point.edit.title';
                    var alertTemplate = 'controller.trip.action_point.edit.template';

                    if (vm.isActionPointNew === true) {
                        loadingMessage = 'updating_action_point';
                        alertTitle = 'controller.trip.action_point.new.title';
                        alertTemplate = 'controller.trip.action_point.new.template';
                    }

                    $ionicLoading.show({
                        template: '<loading message="' + loadingMessage + '"></loading>'
                    });

                    tripService.sendAP(currentTrip.id, $scope.ap,
                        function (success) {
                            $ionicLoading.hide();                            
                            tripService.localTripUpdate(currentTrip.id, success.data);
                            
                            $ionicPopup.alert({
                                title: $translate.instant(alertTitle),
                                template: $translate.instant(alertTemplate)
                            }).then(function(res){                                
                                $state.go('app.dash.reporting_action_point', { 'tripId' :  currentTrip.id });
                            });

                        }, function (err) {
                            errorHandler.popError(err);
                    });
                }
            }
        };
    }
)

.controller('ReportingPicture',function($scope,$ionicPopup, localStorageService, $stateParams, tripService, $http, apiUrlService, errorHandler, networkService, $translate){

        $scope.trip = tripService.getTrip($stateParams.tripId);
        $scope.data = {};

        var mobileUploadPhoto = function(fileURI){

            var options = new FileUploadOptions();
            options.fileKey = "file";
            options.fileName = "picture";
            options.mimeType = "image/jpeg";
            options.params = {caption:($scope.data.caption)? $scope.data.caption : ""};
            options.chunkedMode = false;
            options.headers = {
                Authorization: 'JWT  ' + localStorageService.get('jwtoken'),
                Connection: "close"
            };

            var ft = new FileTransfer();
            ft.upload(fileURI,
                      encodeURI(apiUrlService.BASE() +"/trips/api/"+$stateParams.tripId+"/upload/"),
                      function(mdata){
                        var alertPopup = $ionicPopup.alert({
                          title: $translate.instant('controller.report.picture.upload.success.title'),
                          template: $translate.instant('controller.report.picture.upload.success.template')
                        });
                      },
                      function(err){
                        if (networkService.isOffline() === true) {
                          networkService.showMessage(
                            $translate.instant('controller.report.picture.upload.fail.title'),
                            $translate.instant('controller.report.picture.upload.fail.template')
                          );
                        }
                      },
                      options, true);
        };

        // TODO: check getPicture / takePicture for alert function parameter
        $scope.uploadExisting = function(){
            navigator.camera.getPicture(mobileUploadPhoto,
                function(message) { alert('Failed to access your library'); },
                {quality: 50,
                    destinationType: navigator.camera.DestinationType.FILE_URI,
                    sourceType: navigator.camera.PictureSourceType.PHOTOLIBRARY }
            );
        };
        $scope.takePicture = function(){
            navigator.camera.getPicture(mobileUploadPhoto,
                function(message) { alert('Failed to access camera'); },
                {quality: 50,
                    destinationType: navigator.camera.DestinationType.FILE_URI,
                    sourceType: navigator.camera.PictureSourceType.CAMERA,
                    saveToPhotoAlbum: true}
            );
        };
        //this is for local testing only
        $scope.uploadFile = function(files) {
            var fd = new FormData();
            //Take the first selected file
            fd.append("file", files[0]);
            fd.append('trip', $stateParams.tripId);

            $http.post(apiUrlService.BASE() +"/trips/api/"+$stateParams.tripId+"/upload/", fd,
                {
                    headers: {'Content-Type': undefined },
                    transformRequest: angular.identity
                }).then(
                    function(data){
                        console.log(data);
                    },
                    function(err){
                        console.log(err);
                    }
                );

};


})
.controller('TripDetailCtrl',
    function($scope, $stateParams, tripService, localStorageService, $ionicLoading, $ionicHistory, $state, $ionicPopup, errorHandler, networkService, $translate){

        $scope.trip = tripService.getTrip($stateParams.tripId);
        uid = localStorageService.getObject('currentUser').user_id;

        $scope.checks = {
            supervisor : $scope.trip.supervisor == uid,
            owner: $scope.trip.traveller_id == uid,
            is_approved: $scope.trip.status == "approved",
            not_supervisor_approved: (!$scope.trip.approved_by_supervisor),
            is_planned: $scope.trip.status == "planned",
            is_canceled: $scope.trip.status == "cancelled",
            is_submitted: $scope.trip.status == "submitted",
            report_filled: Boolean($scope.trip.main_observations)
        };
        $scope.approve = function (tripId){
          if (networkService.isOffline() === true) {
            networkService.showMessage();
          } else {

            $ionicLoading.show({
                                  template: '<loading message="sending_report"></loading>'
                                });
            tripService.tripAction(tripId, 'approved', {}).then(
                function(actionSuccess){
                    $ionicLoading.hide();
                    tripService.localTripUpdate(tripId, actionSuccess.data);
                    var alertPopup = $ionicPopup.alert({
                      title: $translate.instant('controller.trip.detail.approved.title'),
                      template: $translate.instant('controller.trip.detail.approved.template')
                    });
                    $ionicHistory.goBack();//('app.dash.my_trips');
                    console.log("Action succeded");
                },
                function(err){
                    errorHandler.popError(err);
                }
            );
          }
        };
        $scope.showConfirm = function(template, succ, fail) {
           var confirmPopup = $ionicPopup.confirm({
             title: $translate.instant('controller.trip.detail.confirm.title'),
             okText: $translate.instant('controller.trip.detail.confirm.ok'),
             cancelText: $translate.instant('controller.trip.detail.confirm.cancel'),
             template: template
           });
           confirmPopup.then(function(res) {
             if(res) {
               console.log(succ);
               succ();
               console.log('You are sure');
             } else {
               console.log(fail);
               console.log('You are not sure');
             }
           });
         };
        $scope.submit = function (tripId){
          if (networkService.isOffline() === true) {
            networkService.showMessage();
          } else {
            $ionicLoading.show({                      
                      template: '<loading message="submitting_trip"></loading>'
            });
            tripService.tripAction(tripId, 'submitted', {}).then(
                function(actionSuccess){
                    $ionicLoading.hide();
                    tripService.localSubmit(tripId);
                    var alertPopup = $ionicPopup.alert({
                      title: $translate.instant('controller.trip.submit.title'),
                      template: $translate.instant('controller.trip.submit.template')
                    });
                    $ionicHistory.goBack();//('app.dash.my_trips');
                    console.log("Action succeded");
                },
                function(err){
                    errorHandler.popError(err);
                }
            );
          }
        };
        $scope.complete_trip = function(tripId){
            var execute_req = function() {
              if (networkService.isOffline() === true) {
                networkService.showMessage();
              } else {
                $ionicLoading.show({
                    template: '<loading message="submitting_trip"></loading>'
                });
                tripService.tripAction(tripId, 'completed', {}).then(
                    function (actionSuccess) {
                        $ionicLoading.hide();
                        tripService.localTripUpdate(tripId, actionSuccess.data);
                        var alertPopup = $ionicPopup.alert({
                          title: $translate.instant('controller.trip.complete.title'),
                          template: $translate.instant('controller.trip.complete.template')
                        });
                        $state.go('app.dash.my_trips');
                        console.log("Action succeeded");
                    },
                    function (err) {
                        errorHandler.popError(err);
                    });
              }
            };
            var now = new Date();
            var trip_end = new Date($scope.trip.to_date);
            now.setHours(0,0,0,0);
            if (now < trip_end){
                $scope.showConfirm($translate.instant('controller.trip.detail.complete.title'), execute_req);
                return;
            }
            execute_req();
        };
        $scope.go_report = function(tripId){
            $state.go('app.dash.reporting', { 'tripId' : tripId });
        };
        $scope.take_notes = function(tripId){
            $state.go('app.dash.notes', {"tripId":tripId});
        };


})
.controller('MyTripsCtrl', function($scope, localStorageService, dataService, $state, tripService, $stateParams,
                                    $ionicLoading, $ionicPopup, $ionicListDelegate, $filter, errorHandler, $ionicHistory) {

        $scope.doRefresh = function() {
            dataService.get_trips(function(res){
                $scope.filteredTrips = $filter('filter')(res,$scope.onlyMe);
                $scope.$broadcast('scroll.refreshComplete');
                console.log("got trips", res);
            }, function(err){
                $scope.$broadcast('scroll.refreshComplete');
                errorHandler.popError(err, false, true);
            }, true);

        };
        console.log("in mytrips");
        console.log(localStorageService.getObject('trips'));

        $scope.onlyMe = function(trip) {
            return trip.traveller_id == localStorageService.getObject('currentUser').user_id;
        };
        $scope.go_report = function(tripId){
            $state.go('app.reporting.text', {"tripId":tripId});
        };
        $scope.submit = function (tripId){
          if (networkService.isOffline() === true) {
            networkService.showMessage();
          } else {
            $ionicListDelegate.closeOptionButtons();
            $ionicLoading.show({
                                  template: '<loading message="submitting_trip"></loading>'
                                });
            tripService.tripAction(tripId, 'submitted', {}).then(
                function(actionSuccess){
                    $ionicLoading.hide();
                    tripService.localSubmit(tripId);
                    var alertPopup = $ionicPopup.alert({
                      title: $translate.instant('controller.my_trips.title'),
                      template: $translate.instant('controller.my_trips.template')
                    });
                    console.log("Action succeded");
                },
                function(err){
                    errorHandler.popError(err);
                }
            );
          }
        };

        var data_success = function(res){
                $scope.filteredTrips = $filter('filter')(res,$scope.onlyMe);
                console.log("got trips", res);
        };
        var data_failed = function(err){
                errorHandler.popError(err);
        };
        dataService.get_trips(data_success,data_failed, $stateParams.refreshed);

})
.controller('SupervisedCtrl', function($scope, localStorageService,
                                       dataService, tripService, $ionicLoading,
                                       $state, $ionicListDelegate, $filter, errorHandler) {


        $scope.doRefresh = function() {
            dataService.get_trips(function(res){
                $scope.filteredTrips = $filter('filter')(res,$scope.onlySupervised);
                $scope.$broadcast('scroll.refreshComplete');
                console.log("got trips", res);
            }, function(err){
                $scope.$broadcast('scroll.refreshComplete');
                errorHandler.popError(err);
            }, true);

        };

        console.log("in supervised");
        console.log(localStorageService.getObject('trips'));
        $scope.onlySupervised = function(trip) {
            return trip.supervisor == localStorageService.getObject('currentUser').user_id;
        };
        dataService.get_trips(
            function(res){
                $scope.filteredTrips = $filter('filter')(res,$scope.onlySupervised);

                console.log("got trips", res);
            },
            function(err){
                errorHandler.popError(err);
            }
        );
        $scope.approve = function (tripId){
          if (networkService.isOffline() === true) {
            networkService.showMessage();
          } else {
            $ionicListDelegate.closeOptionButtons();
            $ionicLoading.show({
                                  template: '<loading message="approving_trip"></loading>'
                                });
            tripService.tripAction(tripId, 'approved', {}).then(
                function(actionSuccess){
                    $ionicLoading.hide();
                    tripService.localTripUpdate(tripId, actionSuccess.data);
                    $state.go('app.dash.my_trips');
                    console.log("Action succeded");
                },
                function(err){
                    errorHandler.popError(err);
                }
            );
          }
        };

})
;