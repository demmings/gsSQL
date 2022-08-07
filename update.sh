sed 's#//  \*\*\* DEBUG START#/*  *** DEBUG START#g' ../../CanadianRetirementPlanner/SQL/Table.js > ./Table.js

sed 's#//  \*\*\* DEBUG START#/*  *** DEBUG START#g' ../../CanadianRetirementPlanner/SQL/Views.js > ./Views.js

sed 's#//  \*\*\* DEBUG START#/*  *** DEBUG START#g' ../../CanadianRetirementPlanner/SQL/SqlTest.js > ./SqlTest.js

sed 's#//  \*\*\* DEBUG START#/*  *** DEBUG START#g' ../../CanadianRetirementPlanner/SQL/Sql.js > ./Sql.js

sed 's#//  \*\*\* DEBUG START#/*  *** DEBUG START#g' ../../CanadianRetirementPlanner/SQL/SimpleParser.js > ./SimpleParser.js

sed 's#//  \*\*\* DEBUG START#/*  *** DEBUG START#g' ../../CanadianRetirementPlanner/SQL/TableData.js > ./TableData.js


# sed -i 's#//  \*\*\* DEBUG END \*\*\*#//  *** DEBUG END  ***/#g'  ./Table.js

# sed -i 's#//  \*\*\* DEBUG END \*\*\*#//  *** DEBUG END  ***/#g'  ./Views.js

# sed -i 's#//  \*\*\* DEBUG END \*\*\*#//  *** DEBUG END  ***/#g'  ./SqlTest.js

# sed -i 's#//  \*\*\* DEBUG END \*\*\*#//  *** DEBUG END  ***/#g'  ./Sql.js

# sed -i 's#//  \*\*\* DEBUG END \*\*\*#//  *** DEBUG END  ***/#g'  ./SimpleParser.js