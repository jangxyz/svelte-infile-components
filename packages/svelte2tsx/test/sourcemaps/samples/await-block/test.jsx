/** tested-ranges: [[8,7,"promise"],[52,3,"bar"],[77,7,"promise"],[139,7,"promise"]] */                                                               {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<>{() => {let _$$p = (promise); __sveltets_1_awaitThen(_$$p, (value) => {<>                                                                           {/**
                      #======                                                [generated] line 3                                                        */}
{#await promise then value}                                                                                                                           {/**
        #======                                                              [original] line 1                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <element foo={value.bar}/>                                                                                                                        {/**
                        #==                                                  [generated] line 4                                                        */}
    <element foo={value.bar}/>                                                                                                                        {/**
                        #==                                                  [original] line 2                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
{() => {let _$$p = (promise); <>                                                                                                                      {/**
                    #======                                                  [generated] line 7                                                        */}
{#await promise}                                                                                                                                      {/**
        #======                                                              [original] line 5                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
{() => {let _$$p = ((__sveltets_2_store_get(promise), $promise)); <>                                                                                  {/**
                                            #======                          [generated] line 13                                                       */}
{#await $promise}                                                                                                                                     {/**
         #======                                                             [original] line 11                                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
/** origin-hash: 1isi3ox */